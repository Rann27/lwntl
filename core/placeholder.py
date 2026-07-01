"""
Image/Illustration Placeholder Preservation

Option A: wrap_placeholders() — tag every placeholder line before sending to AI
          so the model is strongly signalled to keep them verbatim.
Option B: reinsert_missing_placeholders() — after translation, detect any that
          were dropped and reinsert them at their approximate relative position.
          SAFETY: only ever inserts; never removes or modifies existing content.
"""

import re
from typing import List, Dict, Tuple

# Handles all four user-facing variants plus DOCX/PDF parser output:
#   Image PlaceHolder                  (manual, capital H)
#   Image PlaceHolder: filename.jpg
#   Illustration PlaceHolder
#   Illustration PlaceHolder: filename.jpg
#   Image Placeholder: filename.jpg    (DOCX / PDF parser, lowercase h)
_PH_RE = re.compile(
    r'^(?:Image|Illustration)\s+Place[Hh]older(?:\s*:\s*.+)?$',
    re.IGNORECASE,
)

# XML-style tags: models are trained to respect unknown XML and keep its content intact.
# LWNTL_ prefix makes them unique — won't appear in any normal source text.
_OPEN  = '<LWNTL_PRESERVE>'
_CLOSE = '</LWNTL_PRESERVE>'

# Flexible unwrap regex: handles AI lower-casing or mangling the tag
_FULL_TAG_RE = re.compile(
    r'<lwntl_preserve>(.*?)</lwntl_preserve>',
    re.IGNORECASE | re.DOTALL,
)
_STRAY_TAG_RE = re.compile(r'</?lwntl_preserve>', re.IGNORECASE)


def is_placeholder_line(line: str) -> bool:
    return bool(_PH_RE.match(line.strip()))


def wrap_placeholders(content: str) -> str:
    """
    Wrap each image/illustration placeholder line with LWNTL_PRESERVE tags.
    Called before sending content to the AI so it treats the lines as
    must-preserve structural markers rather than translatable text.
    """
    lines = content.split('\n')
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped and is_placeholder_line(stripped):
            out.append(f'{_OPEN}{stripped}{_CLOSE}')
        else:
            out.append(line)
    return '\n'.join(out)


def unwrap_placeholders(content: str) -> str:
    """
    Strip LWNTL_PRESERVE tags from translated content, restoring original
    placeholder text.  Handles three cases:
      1. Full intact pair  → extract inner text
      2. AI lower-cased    → same regex (case-insensitive)
      3. Orphaned tag half → strip the remnant
    """
    result = _FULL_TAG_RE.sub(lambda m: m.group(1).strip(), content)
    result = _STRAY_TAG_RE.sub('', result)
    return result


def extract_placeholder_positions(content: str) -> List[Dict]:
    """
    Return a list of {text, para_index, total_paras} for every placeholder line
    found in content.  para_index / total_paras gives the relative position.
    Works on the raw (pre-wrap) content.
    """
    paras = [p.strip() for p in content.split('\n\n') if p.strip()]
    total = len(paras)
    if total == 0:
        return []

    result: List[Dict] = []
    for i, para in enumerate(paras):
        for line in para.split('\n'):
            stripped = line.strip()
            if is_placeholder_line(stripped):
                result.append({
                    'text': stripped,
                    'para_index': i,
                    'total_paras': total,
                })
    return result


def _placeholder_present(translated: str, ph_text: str) -> bool:
    """Return True if ph_text (or a wrapped/cased variant) appears in translated."""
    lc = translated.lower()
    if ph_text.lower() in lc:
        return True
    if f'{_OPEN}{ph_text}{_CLOSE}'.lower() in lc:
        return True
    return False


def reinsert_missing_placeholders(translated: str, raw_content: str) -> Tuple[str, int]:
    """
    Check for placeholders present in raw_content but absent from translated,
    and reinsert each one as a standalone paragraph at its approximate relative
    position in the translated text.

    Position algorithm:
        ratio = para_index / (total_paras - 1)      (0.0 at start, 1.0 at end)
        target = round(ratio * (n_translated_paras - 1))
        → inserted AFTER target paragraph

    Safety guarantees:
        - Only INSERT operations; existing content is never touched.
        - Returns early (unchanged) if translated is empty.
        - Insertions are logged via the returned count.

    Returns:
        (fixed_translation, n_reinserted)
    """
    if not translated.strip() or not raw_content.strip():
        return translated, 0

    positions = extract_placeholder_positions(raw_content)
    if not positions:
        return translated, 0

    trans_paras = [p for p in translated.split('\n\n') if p.strip()]
    if not trans_paras:
        return translated, 0

    n_trans = len(trans_paras)
    to_insert: List[Tuple[int, str]] = []  # (insert_after_idx, placeholder_text)

    for ph in positions:
        if _placeholder_present(translated, ph['text']):
            continue
        denom = max(ph['total_paras'] - 1, 1)
        ratio = ph['para_index'] / denom
        target = round(ratio * max(n_trans - 1, 0))
        to_insert.append((target, ph['text']))

    if not to_insert:
        return translated, 0

    # Process in reverse order so earlier insertions don't shift later indices
    to_insert.sort(key=lambda x: x[0], reverse=True)

    for idx, text in to_insert:
        insert_at = min(idx + 1, len(trans_paras))
        trans_paras.insert(insert_at, text)

    return '\n\n'.join(trans_paras), len(to_insert)
