"""
Terminology Pre-Pass

Scans the RAW source text of a whole series before any chapter is translated and
proposes glossary entries for recurring terms.

Why this exists
---------------
The per-chapter pipeline can only learn a term after the chapter that introduces
it has finished translating. Until then the model has to invent a rendering, and
whatever it invents is not guaranteed to match the one that later gets locked in.

Measured example (Ochibure Vol. 1): 杖剣 entered the glossary only at chapter 6.
Chapter 4 rendered it "sword-staff" 20 times; from chapter 6 onward the glossary
was obeyed perfectly — 53 occurrences of "staff-sword", zero deviations. The
glossary was never the weak link; the timing was.

Running this pre-pass closes that window: terms are agreed on before chapter 1.

Notes
-----
- Reads only the raw source, so it can run before any translation exists.
- Source terms are required to be in the original script. Raw light-novel text
  often interleaves furigana (【 杖 じよう 剣 けん 】), so the prompt asks for the
  base form with readings stripped.
- Long series are split into batches that fit the model's context; results are
  merged and deduplicated by source term.
- Nothing is written to the glossary here — the caller reviews the proposals first.
"""

import json
import re
from typing import Any, Callable, Dict, List, Optional

# Roughly how much raw source to put in one request. Kept well under typical
# context limits so the pre-pass works on modest models too.
DEFAULT_BATCH_TOKENS = 60_000
MAX_OUTPUT_TOKENS = 4096

# ｦ-ﾟ: half-width katakana (ｱﾘｽ) is Japanese too.
_CJK_CHAR_RE = re.compile(r'[぀-ゟ゠-ヿ一-鿿가-힯㐀-䶿ｦ-ﾟ]')
_CJK_SOURCE_LANGS = ("japanese", "chinese", "korean")


def _is_cjk_source(language: str) -> bool:
    return (language or "").strip().lower() in _CJK_SOURCE_LANGS


def _estimate_tokens(text: str) -> int:
    from .context_window import estimate_tokens
    return estimate_tokens(text)


def _batch_chapters(chapters: List[Dict[str, Any]], batch_tokens: int) -> List[str]:
    """Group raw chapter texts into request-sized batches."""
    batches: List[str] = []
    buf: List[str] = []
    buf_tokens = 0

    for ch in chapters:
        raw = (ch.get("rawContent") or "").strip()
        if not raw:
            continue
        label = f"--- Chapter {ch.get('chapterNumber', '?')}: {ch.get('title', '')} ---"
        piece = f"{label}\n{raw}"
        tokens = _estimate_tokens(piece)

        # A single oversized chapter still goes out on its own rather than being
        # dropped; providers truncate more gracefully than we can guess here.
        if buf and buf_tokens + tokens > batch_tokens:
            batches.append("\n\n".join(buf))
            buf, buf_tokens = [], 0

        buf.append(piece)
        buf_tokens += tokens

    if buf:
        batches.append("\n\n".join(buf))
    return batches


def _build_messages(source_text: str, source_lang: str, target_lang: str,
                    existing_terms: List[str]) -> List[Dict[str, str]]:
    known = ""
    if existing_terms:
        shown = existing_terms[:200]
        known = (
            "\nAlready in the glossary — do NOT propose these again:\n"
            + ", ".join(shown)
            + ("\n(and more)" if len(existing_terms) > len(shown) else "")
            + "\n"
        )

    from .task_prompts import build_task_prompt
    system_prompt = build_task_prompt("prepass", source_lang, target_lang) + "\n" + known

    user_prompt = (
        "RAW SOURCE TEXT:\n"
        f"{source_text}\n\n"
        "Return the JSON array of terminology entries only."
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _extract_text(response: Any) -> str:
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


def _parse_entries(raw: str) -> List[Dict[str, str]]:
    """Pull the JSON array out of a model response, tolerating stray prose/fences."""
    text = (raw or "").strip()
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return []
    try:
        parsed = json.loads(text[start:end + 1])
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []

    out: List[Dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        src = str(item.get("sourceTerm") or "").strip()
        tgt = str(item.get("translatedTerm") or "").strip()
        if not src or not tgt:
            continue
        out.append({
            "sourceTerm": src,
            "translatedTerm": tgt,
            "notes": str(item.get("notes") or "").strip(),
        })
    return out


def run_terminology_prepass(
    llm_client,
    chapters: List[Dict[str, Any]],
    series: Dict[str, Any],
    batch_tokens: int = DEFAULT_BATCH_TOKENS,
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    Propose glossary entries from the raw source of every chapter.

    Returns:
        {"entries": [{sourceTerm, translatedTerm, notes}], "batches": int,
         "skipped": int, "scannedChapters": int}
        Nothing is persisted; the caller decides what to keep.
    """
    def _emit(msg: str):
        if callable(log):
            log(msg)

    source_lang = series.get("sourceLanguage", "Japanese")
    target_lang = series.get("targetLanguage", "English")
    cjk_source = _is_cjk_source(source_lang)

    from .term_match import find_duplicate

    glossary = list(series.get("glossary") or [])
    existing_terms = [
        (e.get("sourceTerm") or "").strip()
        for e in (series.get("glossary") or [])
        if (e.get("sourceTerm") or "").strip()
    ]

    usable = [c for c in chapters if (c.get("rawContent") or "").strip()]
    batches = _batch_chapters(usable, batch_tokens)
    if not batches:
        return {"entries": [], "batches": 0, "skipped": 0, "scannedChapters": 0}

    _emit(f"[Pre-pass] Scanning {len(usable)} chapter(s) in {len(batches)} batch(es)...")

    merged: Dict[str, Dict[str, str]] = {}
    skipped = 0
    duplicates = 0

    for i, batch in enumerate(batches, start=1):
        messages = _build_messages(batch, source_lang, target_lang, existing_terms)
        try:
            response = llm_client.complete(messages, stream=False, max_tokens=MAX_OUTPUT_TOKENS)
        except Exception as e:
            _emit(f"[Pre-pass] Batch {i}/{len(batches)} failed: {e}")
            continue

        entries = _parse_entries(_extract_text(response))
        kept = 0
        for entry in entries:
            src = entry["sourceTerm"]
            key = src.lower()
            # Already in the glossary or proposed by an earlier batch, under any
            # spelling (furigana, width, variant kanji, separators, honorifics).
            if key in merged or find_duplicate(src, "", glossary + list(merged.values())):
                duplicates += 1
                continue
            # For a CJK source a Latin-only source term means the model put the
            # translation in the wrong column — it could never match the raw text.
            if cjk_source and not _CJK_CHAR_RE.search(src):
                skipped += 1
                continue
            # A translation that still contains source-script characters is unusable.
            if cjk_source and _CJK_CHAR_RE.search(entry["translatedTerm"]):
                skipped += 1
                continue
            merged[key] = entry
            kept += 1

        _emit(f"[Pre-pass] Batch {i}/{len(batches)}: {kept} new term(s)")

    if skipped:
        _emit(f"[Pre-pass] Discarded {skipped} malformed entr(ies)")
    if duplicates:
        _emit(f"[Pre-pass] Dropped {duplicates} term(s) already in the glossary or proposed twice")

    result = sorted(merged.values(), key=lambda e: e["sourceTerm"])
    _emit(f"[Pre-pass] {len(result)} term(s) proposed")

    return {
        "entries": result,
        "batches": len(batches),
        "skipped": skipped,
        "scannedChapters": len(usable),
    }
