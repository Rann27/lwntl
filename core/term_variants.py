"""
Resolve inconsistent term renderings found in "All terms".

A source term is inconsistent when the translations render it more than one way
(see AllTermsModal). Two ways out:

  unify   pick one rendering; every other one is rewritten to it across the
          series (translations archived first), the glossary entry ends on it,
          and the chapters' own glossary tables are updated so the rows agree
  accept  the variation is intended (descriptive phrases often are); those
          renderings stop being flagged, stored in series["termVariantsAccepted"]
"""

import json
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List

from .storage.chapters import get_chapters, update_glossary_updates
from .storage.series import get_series, get_series_path, add_glossary_entry, update_glossary_entry
from .storage.atomic import write_json

_HONORIFIC_TAIL = re.compile(r"[-\s](san|kun|chan|sama|senpai|sensei|dono|nee|nii|tan|nim|ssi)\b", re.I)


def rendering_key(text: str) -> str:
    """Same normalisation as renderingKey() in AllTermsModal.tsx."""
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = re.sub("[\u2018\u2019\u201A\u201B\u2032\u02BC`]", "'", t)
    t = re.sub("[\u201C\u201D\u201E\u2033]", '"', t)
    t = re.sub("[\u2010-\u2015]", "-", t)
    t = re.sub(r"\s+", " ", t)
    return _HONORIFIC_TAIL.sub("", t).strip()


def _casings(form: str, canonical: str) -> List[tuple]:
    """(old, new) pairs for the casings a rendering takes in running text."""
    pairs = [(form, canonical),
             (form[:1].upper() + form[1:], canonical[:1].upper() + canonical[1:]),
             (form.title(), canonical.title())]
    seen, out = set(), []
    for old, new in pairs:
        if old and old not in seen and old != new:
            seen.add(old)
            out.append((old, new))
    return out


def _find_entry(series: Dict[str, Any], source_term: str):
    key = source_term.strip().lower()
    for e in series.get("glossary") or []:
        spellings = [e.get("sourceTerm") or ""] + list(e.get("aliases") or [])
        if any(s.strip().lower() == key for s in spellings):
            return e
    return None


def unify(series_id: str, source_term: str, canonical: str, replace: List[str]) -> Dict[str, Any]:
    from .qa_scan import apply_rename
    from .context_window import invalidate_context_cache

    canonical, source_term = (canonical or "").strip(), (source_term or "").strip()
    if not canonical or not source_term:
        raise ValueError("Istilah dan bentuk utama wajib diisi")

    # Longer forms first, so "hubungan pura-pura kami" goes before "hubungan pura-pura".
    forms = sorted({f.strip() for f in replace or [] if f and f.strip()}, key=len, reverse=True)
    replaced, chapters = 0, 0
    for form in forms:
        if rendering_key(form) == rendering_key(canonical):
            continue
        for old, new in _casings(form, canonical):
            r = apply_rename(series_id, old, new, protect=[canonical, new])
            replaced += r.get("replaced", 0)
            chapters = max(chapters, r.get("chapters", 0))

    series = get_series(series_id) or {}
    entry = _find_entry(series, source_term)
    if entry is None:
        add_glossary_entry(series_id, source_term, canonical, "")
    elif entry.get("translatedTerm") != canonical:
        update_glossary_entry(series_id, entry["id"], entry.get("sourceTerm", ""), canonical, entry.get("notes", ""))

    # Each chapter's own table now agrees, so All terms shows one rendering.
    key = source_term.lower()
    for ch in get_chapters(series_id):
        gu = ch.get("glossaryUpdates") or {}
        rows = gu.get("entries") or []
        if not any((r.get("sourceTerm") or "").strip().lower() == key and r.get("translatedTerm") != canonical
                   for r in rows):
            continue
        for r in rows:
            if (r.get("sourceTerm") or "").strip().lower() == key:
                r["translatedTerm"] = canonical
        update_glossary_updates(series_id, ch["id"], {**gu, "entries": rows})

    _set_accepted(series_id, source_term, None)
    invalidate_context_cache(series_id)
    return {"canonical": canonical, "replaced": replaced, "chapters": chapters}


def _set_accepted(series_id: str, source_term: str, renderings) -> Dict[str, List[str]]:
    series = get_series(series_id)
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    accepted = dict(series.get("termVariantsAccepted") or {})
    key = source_term.strip().lower()
    if renderings:
        accepted[key] = sorted({rendering_key(r) for r in renderings if r and r.strip()} | set(accepted.get(key, [])))
    elif key in accepted:
        del accepted[key]
    else:
        return accepted
    series["termVariantsAccepted"] = accepted
    series["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    write_json(get_series_path(series_id), series)
    return accepted


def accept(series_id: str, source_term: str, renderings: List[str]) -> Dict[str, Any]:
    """Stop flagging these renderings of the term ([] clears the decision)."""
    return {"accepted": _set_accepted(series_id, source_term, renderings or None)}
