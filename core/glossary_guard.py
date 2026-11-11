"""
Glossary Guard — keep partial names from forking a character's romanization.

The failure this prevents:
    船坂叶馬 === Funasaka Touma      (locked by the pre-pass)
    a later chapter only says 叶馬; the model never saw "Touma" for it and
    invents a reading, then its glossary table proposes
    叶馬 === Kanouma                 (auto-applied, now locked too)
From there both renderings are "correct" according to the glossary.

Two defences live here:

1. Name parts in the pre-filter (term_match.name_parts) — a full-name entry is
   kept when only its surname or given name appears in the chapter, so the model
   sees the locked romanization at the moment it needs it.

2. `find_conflict` — before a new entry is added, it is compared with existing
   entries whose source term contains it (or is contained by it). A part of a
   name must be rendered with words that appear in the full name's rendering:
       叶馬 = Touma     vs 船坂叶馬 = Funasaka Touma   → consistent, allowed
       叶馬 = Kanouma   vs 船坂叶馬 = Funasaka Touma   → conflict, refused
   Honorific suffixes are ignored on both sides (Touma-kun ≈ Touma).
"""

import re
from typing import Any, Dict, Iterable, List, Optional

_CJK = re.compile(r'[぀-ゟァ-ヺー-ヿ㐀-䶿一-鿿々]')
_HONORIFIC = re.compile(r'^(?:ku+n|sa+n|cha+n|sa+ma|senpai|sempai|sensei|dono|tan|chi|nii|nee|ue)$')


def name_tokens(translated: str) -> List[str]:
    """Lowercased words of a rendering, honorifics dropped (Touma-kun → ['touma'])."""
    out = []
    for w in re.findall(r"[A-Za-zÀ-ɏ']+", translated or ""):
        w = w.lower()
        if w.endswith("'s"):
            w = w[:-2]
        w = w.strip("'")
        if not w or _HONORIFIC.match(w):
            continue
        # Knights ≈ Knight, so "Order of Knights" still contains 騎士 = Knight.
        if len(w) > 3 and w.endswith("s"):
            w = w[:-1]
        out.append(w)
    return out


def _capitalised(translated: str) -> bool:
    m = re.search(r"[A-Za-zÀ-ɏ]", translated or "")
    return bool(m and m.group(0).isupper())


def looks_like_full_name(translated: str) -> bool:
    """Two or more capitalised words — 'Funasaka Touma', not 'Demon King'-style terms only."""
    words = re.findall(r"[A-Za-zÀ-ɏ']+", translated or "")
    caps = [w for w in words if w[:1].isupper() and not _HONORIFIC.match(w.lower())]
    return len(caps) >= 2


def looks_like_person_name(translated: str) -> bool:
    """
    A full name with every word capitalised — 'Onodera Makoto', not 'Order of
    Knights'. One-kanji name parts are only trusted for these.
    """
    words = [w for w in re.findall(r"[A-Za-zÀ-ɏ']+", translated or "") if not _HONORIFIC.match(w.lower())]
    return len(words) >= 2 and all(w[:1].isupper() for w in words)


def find_conflict(
    source_term: str,
    translated: str,
    entries: Iterable[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Return the existing entry this new one contradicts, or None.

    Only entries related by containment are compared (one source term inside the
    other, after term_match normalisation so ・/＝/width variants line up), and
    only when both are rendered as proper nouns (capitalised). The shorter one's
    words must all appear in the longer one's rendering.

    A single character inside a longer term is almost always an unrelated word,
    so it is compared only as the start or end of a full name (誠 in 小野寺誠).
    """
    from .term_match import normalize
    src = normalize(source_term)
    new_tokens = name_tokens(translated)
    if not src or not _CJK.search(src) or not new_tokens:
        return None
    for e in entries:
        other = normalize(e.get("sourceTerm") or "")
        if not other or other == src:
            continue
        if src in other:
            short_src, long_src = src, other
            short_tokens, long_tokens = new_tokens, name_tokens(e.get("translatedTerm", ""))
            long_rendering, short_rendering = e.get("translatedTerm", ""), translated
        elif other in src:
            short_src, long_src = other, src
            short_tokens, long_tokens = name_tokens(e.get("translatedTerm", "")), new_tokens
            long_rendering, short_rendering = translated, e.get("translatedTerm", "")
        else:
            continue
        if len(short_src) < 2 and not (len(long_src) >= 3 and looks_like_person_name(long_rendering)
                                       and (long_src.startswith(short_src) or long_src.endswith(short_src))):
            continue
        # Only proper nouns compose predictably. Ordinary compounds do not
        # (魔力 = mana, 魔力炉 = magic furnace), so both sides must be capitalised.
        if not (_capitalised(long_rendering) and _capitalised(short_rendering)):
            continue
        if not long_tokens or not short_tokens:
            continue
        if not set(short_tokens) <= set(long_tokens):
            return e
    return None


def glossary_conflicts(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Every contradicting pair already in a glossary (for the QA report)."""
    out = []
    for i, e in enumerate(entries):
        hit = find_conflict(e.get("sourceTerm", ""), e.get("translatedTerm", ""), entries[i + 1:])
        if hit:
            out.append({"a": e, "b": hit})
    return out
