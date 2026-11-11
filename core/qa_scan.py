"""
QA Scan — volume-wide deterministic QA (no AI, no tokens).

Runs chapter_check over every translated chapter, then the detectors that only
make sense across chapters:

    name variants        Yuuko / Yuko / Yūko spread over chapters, glossary form marked
    spelling consistency standard vs non-standard Indonesian forms across the volume
    quote style          chapters whose quote style differs from the volume majority
    metronome outliers   chapters whose opener ratio is far above the volume average
    length outliers      chapters much shorter/longer than the volume's typical
                         translated/source ratio — the cheapest omission detector there is
    pronoun usage        kau / kamu / Anda counts per chapter (ID)
    diction density      intensifiers and comparison words per 1000 words, per chapter
    phrase frequency     top words, bigrams, trigrams (material for the diction check)
    glossary health      entries with macrons, Latin source terms, or CJK translations

Also offers preview/apply for the safe fixes in qa_fix.
"""

import re
import statistics
from collections import Counter
from typing import Any, Dict, List, Optional

from .chapter_check import (
    CJK_LETTER, EJAAN_ID, MACRON, STOPWORDS, check_chapter, is_dialogue, lang_code,
    split_paragraphs, volume_name_variants,
)
from .extractor import strip_glossary_table
from .qa_i18n import localize
from .qa_fix import apply_safe_fixes, available_categories, SAFE_CATEGORIES, ID_ONLY
from .storage.chapters import (
    get_chapters, get_chapter, update_chapter_translation, archive_current_translation,
)
from .storage.series import get_series

_DICTION_WATCH = {
    "id": ["seperti", "layaknya", "bagaikan", "seolah", "seakan", "seketika", "tiba-tiba", "langsung",
           "benar-benar", "sungguh", "sangat", "begitu", "sekali", "amat"],
    "en": ["like", "as if", "suddenly", "immediately", "instantly", "really", "truly", "very",
           "incredibly", "completely", "utterly"],
}


def _done_chapters(series_id: str) -> List[Dict[str, Any]]:
    return [c for c in get_chapters(series_id)
            if c.get("status") == "done" and (c.get("translatedContent") or "").strip()]


def _body(ch: Dict[str, Any]) -> str:
    return strip_glossary_table(ch.get("translatedContent", "") or "")


def _words(text: str) -> List[str]:
    return re.findall(r"[a-z]+(?:-[a-z]+)*", text.lower())


# (US, UK) stems; a prefix match covers inflections (colored, colours).
US_UK = [
    ("color", "colour"), ("realiz", "realis"), ("travele", "travelle"), ("gray", "grey"), ("toward", "towards"),
    ("defense", "defence"), ("center", "centre"), ("favor", "favour"), ("honor", "honour"), ("apologiz", "apologis"),
    ("organiz", "organis"), ("analyz", "analys"), ("recogniz", "recognis"), ("neighbor", "neighbour"),
    ("behavior", "behaviour"), ("armor", "armour"), ("theater", "theatre"), ("meter", "metre"),
]


def scan_series(series_id: str, include_low: bool = True) -> Dict[str, Any]:
    series = get_series(series_id) or {}
    target = series.get("targetLanguage", "English")
    source = series.get("sourceLanguage", "Japanese")
    lang = lang_code(target)
    glossary = series.get("glossary") or []
    chapters = _done_chapters(series_id)

    chapter_reports: List[Dict[str, Any]] = []
    bodies: List[str] = []
    for pos, ch in enumerate(chapters, 1):
        rep = check_chapter(ch.get("rawContent", ""), ch.get("translatedContent", ""), glossary, target, source,
                            (ch.get("glossaryUpdates") or {}).get("entries") or [])
        body = _body(ch)
        bodies.append(body)
        findings = rep["findings"] if include_low else [f for f in rep["findings"] if f["severity"] != "low"]
        chapter_reports.append({
            "chapterId": ch["id"],
            "position": pos,
            "chapterNumber": str(ch.get("chapterNumber", "?")),
            "title": ch.get("title", ""),
            "stats": rep["stats"],
            "findings": findings,
        })

    volume: Dict[str, Any] = {}

    # Name variants, with where each form appears and which one the glossary locks.
    glossary_forms = {w for e in glossary for w in re.findall(r"[A-Za-zāīūēōĀĪŪĒŌ]+", e.get("translatedTerm") or "")}
    variants = []
    for g in volume_name_variants(bodies, source):
        forms = []
        for form, count in sorted(g["forms"].items(), key=lambda kv: -kv[1]):
            where = [r["chapterNumber"] for r, b in zip(chapter_reports, bodies)
                     if re.search(r"\b" + re.escape(form) + r"\b", b)]
            forms.append({"form": form, "count": count, "chapters": where[:30],
                          "glossary": form in glossary_forms, "macron": bool(MACRON.search(form))})
        variants.append({"forms": forms})
    volume["nameVariants"] = variants

    # Spelling consistency (ID).
    if lang == "id":
        text = "\n".join(bodies).lower()
        spelling = []
        for good, bad in EJAAN_ID:
            n_bad = len(re.findall(r"\b" + bad + r"[a-z]*\b", text))
            if n_bad:
                n_good = len(re.findall(r"\b" + good + r"[a-z]*\b", text))
                spelling.append({"standard": good, "nonStandard": bad, "nonStandardCount": n_bad,
                                 "standardCount": n_good})
        volume["spelling"] = spelling

    # Spelling consistency (EN) — US and UK forms mixed inside one volume. Which
    # standard is chosen matters less than using one.
    if lang == "en":
        text = "\n".join(bodies).lower()
        mixed = []
        for us, uk in US_UK:
            n_us = len(re.findall(r"\b" + us + r"[a-z]*\b", text))
            n_uk = len(re.findall(r"\b" + uk + r"[a-z]*\b", text))
            if n_us and n_uk:
                mixed.append({"us": us, "uk": uk, "usCount": n_us, "ukCount": n_uk})
        volume["spellingMixed"] = mixed

    # Quote style majority.
    styles = Counter(r["stats"]["quoteStyle"] for r in chapter_reports)
    majority = styles.most_common(1)[0][0] if styles else "straight"
    volume["quoteStyle"] = {
        "majority": majority,
        "deviating": [r["chapterNumber"] for r in chapter_reports if r["stats"]["quoteStyle"] != majority],
    }

    # Metronome outliers relative to the volume.
    ratios = [r["stats"]["openerRatio"] for r in chapter_reports if r["stats"]["paragraphs"] >= 20]
    avg = statistics.mean(ratios) if ratios else 0.0
    volume["openers"] = {
        "average": round(avg, 3),
        "outliers": [{"chapter": r["chapterNumber"], "ratio": r["stats"]["openerRatio"]}
                     for r in chapter_reports
                     if r["stats"]["paragraphs"] >= 20 and r["stats"]["openerRatio"] > max(avg * 1.5, 0.06)],
    }

    # Length outliers — translated/source character ratio against the volume median.
    lr = [r["stats"]["lengthRatio"] for r in chapter_reports if r["stats"]["sourceChars"] >= 500]
    median = statistics.median(lr) if lr else 0.0
    outliers = []
    if median:
        for r in chapter_reports:
            s = r["stats"]
            if s["sourceChars"] < 500:
                continue
            rel = s["lengthRatio"] / median
            if rel < 0.75 or rel > 1.4:
                outliers.append({"chapter": r["chapterNumber"], "ratio": s["lengthRatio"],
                                 "relative": round(rel, 2), "kind": "short" if rel < 1 else "long"})
                detail = (f"Translation is {round(rel * 100)}% of the volume's usual length for this much source — "
                          + ("content may be missing" if rel < 1 else "content may be duplicated or invented"))
                r["findings"].insert(0, {
                    "type": "length_outlier", "severity": "high" if rel < 0.75 else "medium", "para": None,
                    "detail": detail, "detailId": localize(detail) or detail, "text": "",
                })
                r["stats"]["high" if rel < 0.75 else "medium"] += 1
    volume["length"] = {"median": round(median, 3), "outliers": outliers}

    # Pronoun usage per chapter (ID).
    if lang == "id":
        volume["pronouns"] = [{"chapter": r["chapterNumber"], **r["stats"].get("pronouns", {})}
                              for r in chapter_reports]

    # Diction density — intensifiers and comparison words per 1000 words.
    watch = _DICTION_WATCH[lang]
    density = []
    for r, b in zip(chapter_reports, bodies):
        low = b.lower()
        n_words = max(len(_words(b)), 1)
        counts = {w: len(re.findall(r"\b" + re.escape(w) + r"\b", low)) for w in watch}
        density.append({"chapter": r["chapterNumber"],
                        "per1000": round(sum(counts.values()) * 1000 / n_words, 1),
                        "top": sorted(((w, c) for w, c in counts.items() if c), key=lambda x: -x[1])[:5]})
    volume["diction"] = density

    # Phrase frequency.
    words = [w for w in _words("\n".join(bodies)) if len(w) >= 4 and w not in STOPWORDS[lang]]
    volume["frequency"] = {
        "words": Counter(words).most_common(25),
        "bigrams": [(" ".join(k), v) for k, v in Counter(zip(words, words[1:])).most_common(25)],
        "trigrams": [(" ".join(k), v) for k, v in Counter(zip(words, words[1:], words[2:])).most_common(25)],
    }

    # Glossary health.
    health = []
    for e in glossary:
        src, tgt = (e.get("sourceTerm") or "").strip(), (e.get("translatedTerm") or "").strip()
        if MACRON.search(tgt):
            health.append({"sourceTerm": src, "translatedTerm": tgt, "issue": "macron in translation"})
        if CJK_LETTER.search(tgt):
            health.append({"sourceTerm": src, "translatedTerm": tgt, "issue": "Japanese characters in translation"})
        if src and not CJK_LETTER.search(src) and lang_code(series.get("sourceLanguage", "")) != "id" \
                and (series.get("sourceLanguage", "").lower() in ("japanese", "chinese", "korean")):
            health.append({"sourceTerm": src, "translatedTerm": tgt, "issue": "source term is not in source script"})
    from .glossary_guard import glossary_conflicts
    for c in glossary_conflicts(glossary):
        a, b = c["a"], c["b"]
        item = {"sourceTerm": a.get("sourceTerm", ""), "translatedTerm": a.get("translatedTerm", ""),
                "issue": f"contradicts {b.get('sourceTerm', '')} = {b.get('translatedTerm', '')}"}
        item.update(_rename_suggestion(a, b))
        health.append(item)
    volume["glossary"] = health

    totals = {k: sum(r["stats"][k] for r in chapter_reports) for k in ("high", "medium", "low")}
    return {
        "seriesId": series_id,
        "targetLanguage": target,
        "chapters": chapter_reports,
        "volume": volume,
        "totals": totals,
        "chapterCount": len(chapter_reports),
    }


_CHARACTER_NOTE = re.compile(
    r"\b(tokoh|laki-laki|perempuan|protagonis|antagonis|heroine|heroin|"
    r"male|female|protagonist|antagonist)\b")


def _rename_suggestion(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, str]:
    """
    For a part-vs-full-name conflict, guess which word of the full name the part
    should use: a suffix of the source maps to the last word, a prefix to the first
    (Japanese surname-given order, kept by most LN translations). Only a suggestion —
    the user confirms it in the rename tab.
    """
    sa, sb = (a.get("sourceTerm") or ""), (b.get("sourceTerm") or "")
    short, full = (a, b) if len(sa) < len(sb) else (b, a)
    s_src, f_src = short.get("sourceTerm") or "", full.get("sourceTerm") or ""
    words = re.findall(r"[A-Za-zÀ-ɏ']+", full.get("translatedTerm") or "")
    old_words = re.findall(r"[A-Za-zÀ-ɏ']+", short.get("translatedTerm") or "")
    if len(words) < 2 or not old_words:
        return {}
    # Only for characters. For ordinary terms (階層 = Lantai vs 階層守護者 = Floor
    # Guardian) a volume-wide word swap would hit every common use of the word.
    notes = (short.get('notes') or '').lower()
    if not _CHARACTER_NOTE.search(notes):
        return {}
    if f_src.endswith(s_src):
        new = words[-1]
    elif f_src.startswith(s_src):
        new = words[0]
    else:
        return {}
    return {"suggestOld": old_words[0], "suggestNew": new}


def preview_safe_fixes(series_id: str, categories: List[str]) -> Dict[str, Any]:
    """Dry run: what each category would change, per chapter, with a few samples."""
    series = get_series(series_id) or {}
    target = series.get("targetLanguage", "English")
    source = series.get("sourceLanguage", "Japanese")
    per_category = Counter()
    chapters = []
    samples: Dict[str, List[Dict[str, Any]]] = {}
    for ch in _done_chapters(series_id):
        _, changes = apply_safe_fixes(ch.get("translatedContent", ""), categories, target, source)
        if not changes:
            continue
        counts = Counter(c["category"] for c in changes)
        per_category.update(counts)
        chapters.append({"chapterId": ch["id"], "chapterNumber": str(ch.get("chapterNumber", "?")),
                         "changes": dict(counts)})
        for c in changes:
            bucket = samples.setdefault(c["category"], [])
            if len(bucket) < 6:
                bucket.append({"chapter": str(ch.get("chapterNumber", "?")), **c})
    available = available_categories(target, source)
    return {"categories": dict(per_category), "chapters": chapters, "samples": samples, "available": available}


def apply_safe_fixes_to_series(series_id: str, categories: List[str],
                               chapter_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """Apply safe fixes; each changed chapter is archived to version history first."""
    series = get_series(series_id) or {}
    target = series.get("targetLanguage", "English")
    wanted = set(chapter_ids or [])
    changed_chapters = 0
    total = Counter()
    for ch in _done_chapters(series_id):
        if wanted and ch["id"] not in wanted:
            continue
        new_text, changes = apply_safe_fixes(ch.get("translatedContent", ""), categories, target,
                                             series.get("sourceLanguage", "Japanese"))
        if not changes:
            continue
        archive_current_translation(series_id, ch["id"])
        update_chapter_translation(series_id, ch["id"], new_text)
        changed_chapters += 1
        total.update(c["category"] for c in changes)
    return {"chapters": changed_chapters, "categories": dict(total)}


def apply_safe_fixes_to_chapter(series_id: str, chapter_id: str, categories: List[str]) -> int:
    """Used by the agent run before review. Returns the number of paragraph changes."""
    series = get_series(series_id) or {}
    ch = get_chapter(series_id, chapter_id)
    if not ch:
        return 0
    new_text, changes = apply_safe_fixes(ch.get("translatedContent", ""), categories,
                                         series.get("targetLanguage", "English"),
                                         series.get("sourceLanguage", "Japanese"))
    if changes:
        archive_current_translation(series_id, chapter_id)
        update_chapter_translation(series_id, chapter_id, new_text)
    return len(changes)


def compact_volume_report(report: Dict[str, Any], limit: int = 12000) -> str:
    """Plain-text digest of the volume findings for the volume agent."""
    v = report["volume"]
    lines = [f"{report['chapterCount']} chapters | totals {report['totals']}"]
    if v.get("nameVariants"):
        lines.append("\n# Name variants (glossary form marked *)")
        for g in v["nameVariants"][:30]:
            lines.append("  " + ", ".join(
                f"{f['form']}{'*' if f['glossary'] else ''} x{f['count']} (ch {', '.join(f['chapters'][:8])})"
                for f in g["forms"]))
    if v.get("spelling"):
        lines.append("\n# Non-standard spelling")
        for s in v["spelling"]:
            lines.append(f"  {s['nonStandard']} x{s['nonStandardCount']} → {s['standard']} (standard used x{s['standardCount']})")
    if v.get("quoteStyle", {}).get("deviating"):
        lines.append(f"\n# Quote style: majority {v['quoteStyle']['majority']}, deviating chapters "
                     f"{', '.join(v['quoteStyle']['deviating'])}")
    if v.get("length", {}).get("outliers"):
        lines.append("\n# Length outliers (translated/source vs volume median)")
        for o in v["length"]["outliers"]:
            lines.append(f"  ch {o['chapter']}: {o['relative']}x ({o['kind']})")
    if v.get("openers", {}).get("outliers"):
        lines.append(f"\n# Opener outliers (volume avg {v['openers']['average']})")
        for o in v["openers"]["outliers"]:
            lines.append(f"  ch {o['chapter']}: {o['ratio']}")
    if v.get("glossary"):
        lines.append("\n# Glossary issues")
        for g in v["glossary"][:30]:
            lines.append(f"  {g['sourceTerm']} = {g['translatedTerm']}: {g['issue']}")
    if v.get("frequency"):
        lines.append("\n# Most frequent words: " + ", ".join(f"{w} {n}" for w, n in v["frequency"]["words"][:20]))
    text = "\n".join(lines)
    return text if len(text) <= limit else text[:limit] + "\n…[truncated]"


# ---------------------------------------------------------------------------
# Rename — one wrong rendering replaced everywhere it can re-enter the context
# ---------------------------------------------------------------------------

def _rename_re(old: str):
    # Whole word, case-sensitive; suffixes like -kun and 's still match.
    return re.compile(r"(?<![A-Za-zÀ-ɏ])" + re.escape(old) + r"(?![a-zà-ɏ])")


def preview_rename(series_id: str, old: str, new: str) -> Dict[str, Any]:
    """Count occurrences of `old` in translations, summaries, memory and glossary."""
    old = (old or "").strip()
    if not old:
        raise ValueError("Teks lama kosong")
    rx = _rename_re(old)
    series = get_series(series_id) or {}
    chapters = []
    samples = []
    for ch in get_chapters(series_id):
        body_n = len(rx.findall(_body(ch)))
        summary_n = len(rx.findall(ch.get("summary") or ""))
        if body_n or summary_n:
            chapters.append({"chapterId": ch["id"], "chapterNumber": str(ch.get("chapterNumber", "?")),
                             "text": body_n, "summary": summary_n})
            if len(samples) < 6:
                for p in split_paragraphs(_body(ch)):
                    if rx.search(p):
                        samples.append({"chapter": str(ch.get("chapterNumber", "?")), "before": p[:200],
                                        "after": rx.sub(new, p)[:200]})
                        break
    memory_n = sum(len(rx.findall(m.get("content") or "")) for m in series.get("memory") or [])
    glossary = [{"sourceTerm": e.get("sourceTerm", ""), "translatedTerm": e.get("translatedTerm", "")}
                for e in series.get("glossary") or [] if rx.search(e.get("translatedTerm") or "")]
    return {"chapters": chapters, "memory": memory_n, "glossary": glossary, "samples": samples,
            "total": sum(c["text"] + c["summary"] for c in chapters) + memory_n}


def apply_rename(series_id: str, old: str, new: str, protect: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Replace `old` with `new`; changed translations are archived to version history first.

    `protect` lists longer forms that contain `old` and must survive untouched —
    making "Rashoumon" canonical must not turn "Gerbang Rashoumon" into
    "Gerbang Gerbang Rashoumon" when the reverse rename runs.
    """
    import json as _json
    from datetime import datetime
    from .storage.chapters import get_chapter_path, update_chapter_summary
    from .storage.series import get_series_path
    from .context_window import invalidate_context_cache

    old, new = (old or "").strip(), (new or "").strip()
    if not old or not new:
        raise ValueError("Teks lama dan baru wajib diisi")
    rx = _rename_re(old)
    shields = [p for p in (protect or []) if p and old in p and p != old]

    def _sub(text: str):
        for k, p in enumerate(shields):
            text = text.replace(p, f"\ue000{k}\ue001")
        text, count = rx.subn(new, text)
        for k, p in enumerate(shields):
            text = text.replace(f"\ue000{k}\ue001", p)
        return text, count

    changed = 0
    replaced = 0
    for ch in get_chapters(series_id):
        full = ch.get("translatedContent") or ""
        body = strip_glossary_table(full)
        tail = full[len(body):] if body and full.startswith(body) else ""
        new_body, n = _sub(body if tail else full)
        summary = ch.get("summary") or ""
        new_summary, m = _sub(summary)
        entries = (ch.get("glossaryUpdates") or {}).get("entries") or []
        k = 0
        for e in entries:
            e["translatedTerm"], c = _sub(e.get("translatedTerm") or "")
            k += c
        if not (n or m or k):
            continue
        if n:
            archive_current_translation(series_id, ch["id"])
            update_chapter_translation(series_id, ch["id"], new_body + tail)
        if m:
            update_chapter_summary(series_id, ch["id"], new_summary)
        if k:
            fresh = get_chapter(series_id, ch["id"])
            fresh["glossaryUpdates"]["entries"] = entries
            with open(get_chapter_path(series_id, ch["id"]), "w", encoding="utf-8") as f:
                _json.dump(fresh, f, indent=2, ensure_ascii=False)
        changed += 1
        replaced += n + m

    series = get_series(series_id) or {}
    g = 0
    for e in series.get("glossary") or []:
        e["translatedTerm"], c = _sub(e.get("translatedTerm") or "")
        g += c
    mem = 0
    for mm in series.get("memory") or []:
        mm["content"], c = _sub(mm.get("content") or "")
        mem += c
    if g or mem:
        series["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        with open(get_series_path(series_id), "w", encoding="utf-8") as f:
            _json.dump(series, f, indent=2, ensure_ascii=False)
    invalidate_context_cache(series_id)
    return {"chapters": changed, "replaced": replaced + mem, "glossary": g}
