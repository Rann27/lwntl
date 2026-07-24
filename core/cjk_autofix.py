"""
CJK AutoFix — surgical post-processing repair of untranslated CJK leakage.

Designed for UNATTENDED BATCH translation. The observed failure mode is not whole
untranslated sentences but individual, trivial everyday words that randomly leak in
their source-language (CJK) form inside otherwise-correct target-language text.

Strategy — maximize reliability by replacing ONLY the leaked CJK runs:
  1. Find every contiguous run of CJK *letters* in the text (symbols/punctuation are
     exempt — see _is_cjk_letter). Each run is located by exact (line, start, end).
  2. Resolve a target-language replacement for each occurrence INDEPENDENTLY, each with
     its own surrounding context — one batched LLM call (JSON in/out), with a
     per-occurrence fallback call for any straggler. The same CJK word appearing twice
     in different sentences is resolved twice, so each fix is context-appropriate (a
     single kanji can carry several meanings depending on where it sits).
  3. Apply replacements surgically, per occurrence, right-to-left within each line so
     positions never shift. Everything outside the CJK run stays byte-for-byte identical.

There is no "keep the whole line unchanged" guard: a fragment we cannot confidently
resolve is simply left as-is while every other fragment is still fixed. One stubborn
token never blocks the rest — which is the whole point for batch runs.

Symbol exception: a character is only leakage when it is an actual *letter* in a CJK
script (Unicode category starts with 'L'). Intentional markers such as Japanese
dialogue brackets 「」『』【】《》〈〉, the middle dot ・, and decorative symbols
♪ ◆ ❤ are never touched.
"""

import json
import re
import unicodedata
from typing import List, Tuple, Dict, Callable, Optional, Any

# CJK letter ranges (kana, kanji, hangul). Symbols/punctuation that fall inside or
# around these ranges are excluded by the Unicode-category check in _is_cjk_letter.
_LEAK_RANGES: List[Tuple[int, int]] = [
    (0x3040, 0x309F),  # Hiragana
    (0x30A0, 0x30FF),  # Katakana (incl. chōonpu ー)
    (0x3400, 0x4DBF),  # CJK Extension A
    (0x4E00, 0x9FFF),  # CJK Unified Ideographs
    (0xAC00, 0xD7AF),  # Hangul Syllables
    (0xF900, 0xFAFF),  # CJK Compatibility Ideographs
]

# A long text whose CJK-letter share exceeds this is treated as a failed /
# untranslated chapter (not noise), and AutoFix bails out entirely. The guard only
# applies past _GUARD_MIN_CHARS so short-but-noisy passages are still repaired.
_MAX_CJK_SHARE = 0.15
_GUARD_MIN_CHARS = 800

# Context window (chars each side of a run) passed to the model for sense selection.
_CONTEXT_RADIUS = 80

# A single leaked everyday word should map to a short replacement. Longer responses
# are treated as the model over-generating and routed to the fallback path.
_MAX_FIX_LEN = 60

# Unique fragments per batched LLM call.
_BATCH_SIZE = 40


def _is_cjk_letter(ch: str) -> bool:
    """True only for CJK-script *letters*. All symbols/punctuation are exempt."""
    cp = ord(ch)
    for lo, hi in _LEAK_RANGES:
        if lo <= cp <= hi:
            # EXCEPTION: only letters count as leakage. Every symbol/punctuation
            # mark (「」『』【】・♪◆❤ …) is intentional and left untouched.
            return unicodedata.category(ch)[0] == 'L'
    return False


def line_has_cjk(text: str) -> bool:
    """True if the string contains at least one CJK-script letter."""
    return any(_is_cjk_letter(c) for c in text)


def _find_runs(s: str) -> List[Tuple[int, int, str]]:
    """Return (start, end, fragment) for each contiguous run of CJK letters in s."""
    runs: List[Tuple[int, int, str]] = []
    i, n = 0, len(s)
    while i < n:
        if _is_cjk_letter(s[i]):
            j = i
            while j < n and _is_cjk_letter(s[j]):
                j += 1
            runs.append((i, j, s[i:j]))
            i = j
        else:
            i += 1
    return runs


def _context_for(line: str, start: int, end: int) -> str:
    a = max(0, start - _CONTEXT_RADIUS)
    b = min(len(line), end + _CONTEXT_RADIUS)
    return line[a:b].strip()


def _sanitize_fix(fix: str) -> str:
    """Trim whitespace and a single layer of wrapping quotes the model may add."""
    f = (fix or "").strip()
    if len(f) >= 2 and f[0] == f[-1] and f[0] in ("'", '"', "“", "”", "「", "『"):
        f = f[1:-1].strip()
    return f


def _extract_text(response: Any) -> str:
    """Extract text content from a non-stream completion response."""
    try:
        if not (hasattr(response, "choices") and response.choices):
            return ""
        choice = response.choices[0]
        if not hasattr(choice, "message"):
            return ""
        content = getattr(choice.message, "content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    parts.append(str(item.get("text") or item.get("content") or ""))
            return "".join(parts)
    except Exception:
        pass
    return ""


def _accept(fix: str) -> Optional[str]:
    """Return a usable replacement, or None if it must be rejected."""
    f = _sanitize_fix(fix)
    if not f:
        return None
    if line_has_cjk(f):          # model echoed CJK back — useless
        return None
    if len(f) > _MAX_FIX_LEN:    # over-generation, not a word swap
        return None
    return f


def _batch_fix(
    llm_client,
    items: List[Tuple[int, str, str]],
    target_language: str,
    emit: Callable[[str], None],
) -> Dict[int, str]:
    """Resolve many occurrences in one call — each with its own context.

    Args:
        items: list of (occurrence_id, fragment, context).

    Returns:
        {occurrence_id: replacement} for every occurrence the model resolved cleanly.
    """
    payload = [
        {"id": oid, "cjk": frag, "context": ctx}
        for (oid, frag, ctx) in items
    ]
    valid_ids = {oid for (oid, _, _) in items}

    system_prompt = (
        f"You repair a {target_language} light/web-novel translation in which a few "
        "individual words randomly leaked in their original CJK form (Japanese "
        "kana/kanji or Korean hangul). These are ordinary everyday words.\n\n"
        "For each item you receive the leaked 'cjk' fragment and a 'context' snippet "
        "showing how it is used. Return the correct inline replacement for that "
        f"fragment in that context.\n\n"
        "RULES:\n"
        f"- 'fix' must be pure {target_language} with NO CJK characters at all.\n"
        "- Give ONLY the replacement word(s) that slot directly in place of the cjk "
        "fragment — no added punctuation, quotes, or surrounding words.\n"
        "- Match the surrounding tone and grammatical form.\n"
        "- Output ONLY a JSON array like "
        '[{"id":0,"fix":"contract"},{"id":1,"fix":"results"}] — no markdown, no prose.'
    )
    user_prompt = (
        "Resolve every item. Return the JSON array only:\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )

    try:
        response = llm_client.complete(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=False,
            max_tokens=2048,
        )
    except Exception as e:
        emit(f"[AutoFix CJK] Batch call failed: {e}")
        return {}

    raw = _extract_text(response).strip()
    # Isolate the JSON array even if the model wrapped it in fences/prose.
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1 or end <= start:
        emit("[AutoFix CJK] Batch response had no JSON array")
        return {}

    try:
        parsed = json.loads(raw[start:end + 1])
    except Exception as e:
        emit(f"[AutoFix CJK] Batch JSON parse failed: {e}")
        return {}

    result: Dict[int, str] = {}
    for item in parsed if isinstance(parsed, list) else []:
        if not isinstance(item, dict):
            continue
        try:
            oid = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        if oid not in valid_ids:
            continue
        good = _accept(str(item.get("fix", "")))
        if good is not None:
            result[oid] = good
    return result


def _single_fix(
    llm_client,
    fragment: str,
    context: str,
    target_language: str,
    emit: Callable[[str], None],
) -> Optional[str]:
    """Last-resort per-fragment call for stragglers the batch didn't resolve."""
    system_prompt = (
        f"Translate a single leaked CJK word into {target_language}. Output ONLY the "
        f"{target_language} replacement word(s) — no quotes, no punctuation, no "
        "explanation, and absolutely no CJK characters."
    )
    user_prompt = f"Word: {fragment}\nUsed as: {context}\nReplacement:"
    try:
        response = llm_client.complete(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=False,
            max_tokens=64,
        )
    except Exception as e:
        emit(f"[AutoFix CJK] Fallback call failed for {fragment!r}: {e}")
        return None
    return _accept(_extract_text(response))


def _chunks(seq: List[Any], size: int):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def autofix_cjk_text(
    llm_client,
    text: str,
    target_language: str = "English",
    log: Optional[Callable[[str], None]] = None,
) -> Tuple[str, int]:
    """
    Surgically replace leaked CJK words with their target-language equivalents.

    Returns:
        (fixed_text, occurrences_replaced) — fixed_text equals input when nothing changed.
    """
    if not text or not text.strip():
        return text, 0

    def _emit(msg: str):
        if callable(log):
            log(msg)

    lines = text.split("\n")

    # Locate every CJK run, remembering its exact position for surgical replacement.
    # Each occurrence is independent and carries its OWN context so the same word in
    # two different sentences can resolve to two different, context-appropriate fixes.
    # occurrences: list of (occurrence_id, line_idx, start, end, fragment, context)
    occurrences: List[Tuple[int, int, int, int, str, str]] = []
    total_cjk_chars = 0
    for li, line in enumerate(lines):
        for (s, e, frag) in _find_runs(line):
            oid = len(occurrences)
            occurrences.append((oid, li, s, e, frag, _context_for(line, s, e)))
            total_cjk_chars += (e - s)

    if not occurrences:
        return text, 0

    # Guard: a long text with a huge CJK share is an untranslated/failed chapter,
    # not noise. AutoFix is for stray words, not for translating a whole chapter —
    # bail out. Short passages skip the guard so genuinely noisy ones still get fixed.
    visible_chars = sum(1 for c in text if not c.isspace())
    if visible_chars > _GUARD_MIN_CHARS and (total_cjk_chars / visible_chars) > _MAX_CJK_SHARE:
        _emit(
            f"[AutoFix CJK] Skipped — CJK share {total_cjk_chars}/{visible_chars} "
            f">{int(_MAX_CJK_SHARE * 100)}% (looks like an untranslated chapter, not noise)"
        )
        return text, 0

    _emit(f"[AutoFix CJK] {len(occurrences)} occurrence(s) to resolve in context")

    # Resolve each occurrence (batched), then fill gaps with per-occurrence fallback.
    fixes: Dict[int, str] = {}
    batch_items = [(oid, frag, ctx) for (oid, _, _, _, frag, ctx) in occurrences]
    for chunk in _chunks(batch_items, _BATCH_SIZE):
        fixes.update(_batch_fix(llm_client, chunk, target_language, _emit))

    unresolved = [(oid, frag, ctx) for (oid, frag, ctx) in batch_items if oid not in fixes]
    if unresolved:
        _emit(f"[AutoFix CJK] Fallback resolving {len(unresolved)} occurrence(s)")
        for oid, frag, ctx in unresolved:
            single = _single_fix(llm_client, frag, ctx, target_language, _emit)
            if single is not None:
                fixes[oid] = single

    if not fixes:
        _emit("[AutoFix CJK] Nothing resolved; text unchanged")
        return text, 0

    # Apply surgically, per line, right-to-left so earlier positions stay valid.
    by_line: Dict[int, List[Tuple[int, int, int]]] = {}
    for (oid, li, s, e, _frag, _ctx) in occurrences:
        by_line.setdefault(li, []).append((s, e, oid))

    replaced = 0
    for li, runs in by_line.items():
        line = lines[li]
        for (s, e, oid) in sorted(runs, key=lambda r: r[0], reverse=True):
            fix = fixes.get(oid)
            if fix is not None:
                line = line[:s] + fix + line[e:]
                replaced += 1
        lines[li] = line

    still = sum(1 for ln in lines if line_has_cjk(ln))
    _emit(
        f"[AutoFix CJK] Replaced {replaced}/{len(occurrences)} occurrence(s)"
        + (f"; {still} line(s) still contain CJK" if still else "; all clear")
    )
    return "\n".join(lines), replaced
