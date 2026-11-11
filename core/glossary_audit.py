"""
Glossary Audit — which entries earn their place (no AI, no tokens).

A glossary grows two ways: the terminology pre-pass (deliberate) and per-chapter
auto-apply (whatever the model put in its table). The second path fills the
glossary with one-off nouns and ordinary words; the real cost is not tokens (the
pre-filter only injects what a chapter contains) but noise — wrong or redundant
entries are locked as "non-negotiable" and nobody can find the ones that matter.

For every entry this measures:
    srcChapters / srcCount  how often the source term occurs in the raw text
                            (furigana-aware: 小お野の寺でら誠せい一いち still counts as 小野寺誠一)
    usedCount               how often the locked rendering occurs in the translations
    variants                other renderings the chapters' own glossary tables used,
                            with how often each actually appears in the text
and suggests:
    remove   never in the source, or a single-chapter non-character term
    check    contradicts a related name, or the text uses another rendering
    keep     everything else
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from . import term_match
from .extractor import strip_glossary_table
from .glossary_guard import find_conflict, looks_like_full_name
from .qa_fix import _fix_homoglyph
from .storage.chapters import get_chapters
from .storage.series import get_series, get_series_path

_CHARACTER_NOTE = re.compile(
    r"\b(tokoh|laki-laki|perempuan|protagonis|antagonis|heroine|heroin|male|female|protagonist|antagonist)\b",
    re.I)


def is_character(entry: Dict[str, Any]) -> bool:
    return bool(_CHARACTER_NOTE.search(entry.get("notes") or ""))


# Latin-looking letters from other scripts (Cyrillic о, Greek ο …) that models
# sometimes emit inside a romanized word — the word then never matches anything.
HOMOGLYPH = re.compile(r'[A-Za-z][Ѐ-ӿͰ-Ͽ]|[Ѐ-ӿͰ-Ͽ][A-Za-z]')


def count_source(term: str, raws: List[str], name_parts: bool = False,
                 aliases: Optional[List[str]] = None) -> Dict[str, int]:
    """
    Occurrences of a source term, matched the way the pre-filter matches it
    (core/term_match: furigana, width, variant kanji, separators, aliases). With
    name_parts, a full name also counts where only its surname or given name
    appears (小野寺誠一 ← 誠一) — characters are mostly referred to that way.
    """
    entry = {"sourceTerm": term or "", "aliases": list(aliases or [])}
    if not term_match.entry_forms(entry):
        return {"chapters": 0, "count": 0}
    counts = [term_match.count(entry, term_match.normalize_text(r), parts=name_parts) for r in raws]
    return {"chapters": sum(1 for c in counts if c), "count": sum(counts)}


def _count_rendering(rendering: str, text: str, text_lower: str) -> int:
    r = (rendering or "").strip()
    if not r:
        return 0
    if r[:1].isupper():
        return len(re.findall(r"(?<![A-Za-zÀ-ɏ])" + re.escape(r) + r"(?![a-zà-ɏ])", text))
    return len(re.findall(r"(?<![a-zà-ɏ])" + re.escape(r.lower()) + r"(?![a-zà-ɏ])", text_lower))


def audit_glossary(series_id: str) -> Dict[str, Any]:
    series = get_series(series_id) or {}
    glossary = series.get("glossary") or []
    chapters = get_chapters(series_id)
    raws = [c.get("rawContent") or "" for c in chapters]
    texts = [strip_glossary_table(c.get("translatedContent") or "") for c in chapters]
    all_text = "\n".join(texts)
    all_lower = all_text.lower()

    # Renderings each chapter's own table proposed, per source term.
    proposed: Dict[str, Dict[str, List[str]]] = {}
    for c in chapters:
        for e in (c.get("glossaryUpdates") or {}).get("entries") or []:
            src, tgt = (e.get("sourceTerm") or "").strip(), (e.get("translatedTerm") or "").strip()
            if src and tgt:
                proposed.setdefault(src, {}).setdefault(tgt, []).append(str(c.get("chapterNumber", "?")))

    ignored = _ignore_map(series)

    rows = []
    for pos, e in enumerate(glossary):
        src, tgt = (e.get("sourceTerm") or "").strip(), (e.get("translatedTerm") or "").strip()
        character = is_character(e)
        sc = count_source(src, raws, name_parts=character or looks_like_full_name(tgt), aliases=e.get("aliases"))
        used = _count_rendering(tgt, all_text, all_lower)
        if not used and looks_like_full_name(tgt):
            # Characters are mostly called by one part of the name.
            used = max((_count_rendering(w, all_text, all_lower)
                        for w in re.findall(r"[A-Za-zÀ-ɏ']{3,}", tgt)), default=0)
        flags: List[str] = []
        variants = []
        normalized = _fix_homoglyph(tgt)
        for form, chs in (proposed.get(src) or {}).items():
            # The homoglyph-free spelling of the entry is the entry itself, not a rival.
            if form.lower() in (tgt.lower(), normalized.lower()) or len(form) > 60:
                continue
            n = _count_rendering(form, all_text, all_lower)
            if n:
                variants.append({"form": form, "count": n, "chapters": sorted(set(chs))[:10]})
        conflict = find_conflict(src, tgt, [x for x in glossary if x is not e])
        # Only the later entry of a pair is flagged, so merging it into the older
        # one (which was locked first) settles the pair.
        dup = term_match.find_duplicate(src, tgt, glossary[:pos])
        duplicate = dup[1] if dup else None
        if dup:
            flags.append("duplicate" if dup[0] == term_match.SAME else "same_rendering")

        if sc["chapters"] == 0:
            flags.append("not_in_source")
        elif sc["chapters"] == 1 and not character:
            flags.append("single_chapter")
        if tgt[:1].islower():
            flags.append("common_word")
        if sc["chapters"] and used == 0:
            flags.append("rendering_unused")
        if variants:
            flags.append("variants_in_text")
        if conflict:
            flags.append("conflict")
        homoglyph = bool(HOMOGLYPH.search(tgt))
        if homoglyph:
            flags.append("homoglyph")

        # Flags the user already reviewed for this exact rendering stay quiet.
        quiet = ignored.get((e.get("id"), tgt), set())
        flags = [f for f in flags if f not in quiet]
        if "variants_in_text" in quiet:
            variants = []
        if "conflict" in quiet:
            conflict = None
        if not ({"duplicate", "same_rendering"} & set(flags)):
            duplicate = None
        homoglyph = homoglyph and "homoglyph" not in quiet
        unused_check = "rendering_unused" in flags and sc["chapters"] >= 2

        if duplicate or homoglyph or conflict or variants or unused_check:
            suggestion = "check"
        elif character and "not_in_source" in flags:
            # Never suggest deleting a character outright — the raw may spell the
            # name in a form this matcher does not see (kana, a different kanji).
            suggestion = "check"
        elif "not_in_source" in flags or "single_chapter" in flags:
            suggestion = "remove"
        else:
            suggestion = "keep"

        row = {
            "id": e.get("id"), "sourceTerm": src, "translatedTerm": tgt, "notes": e.get("notes") or "",
            "srcChapters": sc["chapters"], "srcCount": sc["count"], "usedCount": used,
            "character": character, "flags": flags, "variants": variants,
            "conflictWith": (f"{conflict.get('sourceTerm')} = {conflict.get('translatedTerm')}" if conflict else ""),
            "conflictEntry": ({k: conflict.get(k) for k in ("id", "sourceTerm", "translatedTerm", "notes")}
                              if conflict else None),
            "aliases": list(e.get("aliases") or []),
            "duplicateOf": ({k: duplicate.get(k) for k in ("id", "sourceTerm", "translatedTerm", "notes")}
                            if duplicate else None),
            "suggestion": suggestion,
        }
        if suggestion == "check":
            row["resolution"] = _resolution(e, row, conflict, normalized, homoglyph, all_text, all_lower,
                                            duplicate)
        rows.append(row)

    order = {"check": 0, "remove": 1, "keep": 2}
    rows.sort(key=lambda r: (order[r["suggestion"]], -r["srcChapters"], r["sourceTerm"]))
    return {
        "entries": rows,
        "summary": {k: sum(1 for r in rows if r["suggestion"] == k) for k in order},
        "total": len(rows),
        "chapters": len(chapters),
    }


# ---------------------------------------------------------------------------
# Resolution — pick one canonical rendering and make everything follow it
# ---------------------------------------------------------------------------

def _ignore_map(series: Dict[str, Any]) -> Dict[tuple, set]:
    out: Dict[tuple, set] = {}
    for item in series.get("glossaryAuditIgnore") or []:
        out.setdefault((item.get("entryId"), item.get("translatedTerm")), set()).update(item.get("flags") or [])
    return out


def _part_of_name(entry: Dict[str, Any], full: Dict[str, Any]) -> Optional[str]:
    """
    The word of a full name that a part of it should use. A suffix of the source
    maps to the last word, a prefix to the first (surname-given order, as most LN
    translations keep it). None when `entry` is not part of `full`.
    """
    src, fsrc = (entry.get("sourceTerm") or ""), (full.get("sourceTerm") or "")
    if not src or src == fsrc or src not in fsrc:
        return None
    # Only people's names split cleanly into words. 階層 inside 階層守護者 (Floor
    # Guardian) does not mean 階層 should become "Floor".
    if not (is_character(entry) or is_character(full)):
        return None
    words = re.findall(r"[A-Za-zÀ-ɏ']+", full.get("translatedTerm") or "")
    if len(words) < 2:
        return None
    if fsrc.endswith(src):
        return words[-1]
    if fsrc.startswith(src):
        return words[0]
    return None


def _resolution(entry, row, conflict, normalized, homoglyph, text, text_lower, duplicate=None) -> Dict[str, Any]:
    """
    Candidate canonical renderings for an entry under review, with a default pick.

    Each candidate: {form, count, origin, note}. `confident` marks defaults that
    are safe to apply in bulk (a homoglyph cleanup, a name part taking the word
    of its full name, or merging a duplicate that already shares its rendering);
    anything else is a choice for the user.
    """
    if duplicate is not None:
        return _duplicate_resolution(row, duplicate, text, text_lower)
    tgt = row["translatedTerm"]
    cands: List[Dict[str, Any]] = []

    def add(form: str, origin: str, note: str = ""):
        form = (form or "").strip()
        if not form or any(c["form"] == form for c in cands):
            return
        cands.append({"form": form, "count": _count_rendering(form, text, text_lower), "origin": origin, "note": note})

    preselect, confident, reason = None, False, ""
    if homoglyph:
        add(normalized, "normalized", "ejaan glosarium tanpa huruf Sirilik/Yunani")
        preselect, confident, reason = normalized, True, "Huruf kembar dibersihkan; bentuknya tidak berubah di mata."
    add(tgt if not homoglyph else "", "glossary", "bentuk di glosarium sekarang")
    if homoglyph:
        cands.append({"form": tgt, "count": row["usedCount"], "origin": "glossary",
                      "note": "bentuk di glosarium sekarang (mengandung huruf kembar)"})
    for v in row["variants"]:
        add(v["form"], "variant", f"dipakai di bab {', '.join(v['chapters'])}")

    if conflict:
        word = _part_of_name(entry, conflict)
        if word:
            add(word, "name", f"dari nama lengkap {conflict.get('sourceTerm')} = {conflict.get('translatedTerm')}")
            if not preselect:
                preselect, confident = word, True
                reason = (f"{row['sourceTerm']} adalah bagian dari {conflict.get('sourceTerm')}, "
                          f"jadi memakai kata yang sama dengan nama lengkapnya.")

    if not preselect and len(cands) > 1:
        top = max(cands, key=lambda c: c["count"])
        preselect, reason = top["form"], "Bentuk yang paling sering dipakai di teks."
    if not preselect and cands:
        preselect = cands[0]["form"]

    kind = ("homoglyph" if homoglyph else "name_part" if conflict and _part_of_name(entry, conflict)
            else "variants" if row["variants"] else "conflict" if conflict else "unused")
    return {"kind": kind, "candidates": cands, "preselect": preselect, "confident": confident, "reason": reason}


def _duplicate_resolution(row, duplicate, text, text_lower) -> Dict[str, Any]:
    """Merge a later entry into the older one; pick the rendering both should keep."""
    older = (duplicate.get("translatedTerm") or "").strip()
    mine = row["translatedTerm"]
    cands: List[Dict[str, Any]] = []
    for form, origin, note in ((older, "duplicate", f"entri lama {duplicate.get('sourceTerm')}"),
                               (mine, "glossary", "entri ini")):
        if form and not any(c["form"] == form for c in cands):
            cands.append({"form": form, "count": _count_rendering(form, text, text_lower),
                          "origin": origin, "note": note})
    for v in row["variants"]:
        if not any(c["form"] == v["form"] for c in cands):
            cands.append({"form": v["form"], "count": v["count"], "origin": "variant",
                          "note": f"dipakai di bab {', '.join(v['chapters'])}"})
    same = len(cands) == 1
    if same:
        preselect, reason = older, "Terjemahannya sudah sama; cukup digabung."
    else:
        top = max(cands, key=lambda c: c["count"])
        preselect, reason = top["form"], "Bentuk yang paling sering dipakai di teks."
    return {"kind": "duplicate" if "duplicate" in row["flags"] else "same_rendering",
            "candidates": cands, "preselect": preselect, "confident": same, "reason": reason}


def _apply_canonical(series_id: str, entry_id: str, canonical: str, replace: List[str]) -> Dict[str, Any]:
    """Rewrite `replace` forms to `canonical` everywhere and put the entry on it."""
    from .qa_scan import apply_rename
    from .storage.series import update_glossary_entry

    forms = [f.strip() for f in replace or [] if f and f.strip() and f.strip() != canonical]
    # Longer forms first, so "Gerbang Rashoumon" is handled before "Rashoumon".
    forms.sort(key=len, reverse=True)
    replaced, chapters = 0, 0
    for old in forms:
        r = apply_rename(series_id, old, canonical, protect=[canonical])
        replaced += r["replaced"]
        chapters = max(chapters, r["chapters"])
    # The rename already rewrote matching glossary renderings; make sure this
    # entry ends up exactly on the canonical form either way.
    fresh = next((e for e in (get_series(series_id) or {}).get("glossary") or [] if e.get("id") == entry_id), None)
    if fresh and fresh.get("translatedTerm") != canonical:
        update_glossary_entry(series_id, entry_id, fresh.get("sourceTerm", ""), canonical, fresh.get("notes", ""))
    return {"replaced": replaced, "chapters": chapters}


def resolve_entry(series_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply one decision from the review flow.

    action:
      {"type": "canonical", "entryId", "canonical", "replace": [forms]}
          make `canonical` the entry's rendering and rewrite every listed form to it
          in translations, summaries, memory and the glossary (archived first)
      {"type": "ignore", "entryId", "flags": [...]}
          the current rendering is fine; stop flagging these issues for it
      {"type": "delete", "entryId"}
          remove the entry (backed up)
      {"type": "merge", "entryId", "intoId", "canonical", "replace": [forms]}
          fold a duplicate into an older entry: its source spellings become aliases
          of the older one, both end on `canonical` (forms rewritten as above),
          and the duplicate is removed (backed up)
    """
    from .storage.series import add_glossary_alias
    from .context_window import invalidate_context_cache

    series = get_series(series_id)
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    entry = next((e for e in series.get("glossary") or [] if e.get("id") == action.get("entryId")), None)
    if entry is None:
        raise ValueError("Entri glosarium tidak ditemukan")
    kind = action.get("type")

    if kind == "delete":
        return {"type": "delete", **delete_entries(series_id, [entry["id"]])}

    if kind == "ignore":
        flags = [f for f in action.get("flags") or [] if isinstance(f, str)]
        items = [i for i in series.get("glossaryAuditIgnore") or []
                 if not (i.get("entryId") == entry["id"] and i.get("translatedTerm") == entry.get("translatedTerm"))]
        items.append({"entryId": entry["id"], "translatedTerm": entry.get("translatedTerm"), "flags": flags,
                      "at": datetime.utcnow().isoformat() + "Z"})
        # A conflict is a pair: accepting it on one side accepts it on the other.
        partner = next((e for e in series.get("glossary") or [] if e.get("id") == action.get("partnerId")), None)
        if partner and "conflict" in flags:
            items = [i for i in items if not (i.get("entryId") == partner["id"]
                                              and i.get("translatedTerm") == partner.get("translatedTerm"))]
            items.append({"entryId": partner["id"], "translatedTerm": partner.get("translatedTerm"),
                          "flags": ["conflict"], "at": datetime.utcnow().isoformat() + "Z"})
        series["glossaryAuditIgnore"] = items
        with open(get_series_path(series_id), "w", encoding="utf-8") as f:
            json.dump(series, f, indent=2, ensure_ascii=False)
        return {"type": "ignore", "flags": flags}

    if kind == "canonical":
        canonical = (action.get("canonical") or "").strip()
        if not canonical:
            raise ValueError("Bentuk utama kosong")
        r = _apply_canonical(series_id, entry["id"], canonical, action.get("replace") or [])
        invalidate_context_cache(series_id)
        return {"type": "canonical", "canonical": canonical, **r}

    if kind == "merge":
        into = next((e for e in series.get("glossary") or [] if e.get("id") == action.get("intoId")), None)
        if into is None or into.get("id") == entry["id"]:
            raise ValueError("Entri tujuan penggabungan tidak ditemukan")
        canonical = (action.get("canonical") or into.get("translatedTerm") or "").strip()
        if not canonical:
            raise ValueError("Bentuk utama kosong")
        replace = list(action.get("replace") or [])
        for form in (into.get("translatedTerm"), entry.get("translatedTerm")):
            if form and form != canonical and form not in replace:
                replace.append(form)
        r = _apply_canonical(series_id, into["id"], canonical, replace)
        # The duplicate goes first, so its spellings are free to become aliases.
        spellings = [entry.get("sourceTerm", "")] + list(entry.get("aliases") or [])
        removed = delete_entries(series_id, [entry["id"]])
        aliases = []
        for s in spellings:
            try:
                add_glossary_alias(series_id, into["id"], s)
                aliases.append(s)
            except ValueError:
                pass
        invalidate_context_cache(series_id)
        return {"type": "merge", "canonical": canonical, "aliases": aliases, "backup": removed.get("backup", ""), **r}

    raise ValueError(f"Aksi tidak dikenal: {kind}")


def delete_entries(series_id: str, entry_ids: List[str]) -> Dict[str, Any]:
    """Delete entries in one write; the removed entries are saved to a backup file first."""
    from .context_window import invalidate_context_cache

    series = get_series(series_id)
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    ids = set(entry_ids or [])
    removed = [e for e in series.get("glossary") or [] if e.get("id") in ids]
    if not removed:
        return {"deleted": 0, "backup": ""}

    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    backup = get_series_path(series_id).parent / f"glossary-removed-{stamp}.json"
    with open(backup, "w", encoding="utf-8") as f:
        json.dump(removed, f, indent=2, ensure_ascii=False)

    series["glossary"] = [e for e in series["glossary"] if e.get("id") not in ids]
    series["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    with open(get_series_path(series_id), "w", encoding="utf-8") as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    invalidate_context_cache(series_id)
    return {"deleted": len(removed), "backup": str(backup)}
