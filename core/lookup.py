"""
Look Up — carry the previous chapters' actual translation into context.

Rolling memory summarises plot: "Shinya beat Cyril in the duel", capped at a few
hundred characters. That is enough to keep events straight and useless for
everything else — it never shows how a sentence was built, what register the
narration settled on, or how a term reads inside a real line. Style drift at
chapter boundaries comes from exactly that blind spot.

This layer closes it by handing the model the real translated text of the last N
chapters, plus the glossary terms those chapters established.

The two layers are complementary, not competing, and are split by distance:

    Look Up        N most recent chapters, full text   → prose and voice
    Rolling memory everything before that, summarised  → story arc
    Long memory    compacted, distant                  → background

Carrying real text has a cost worth naming: a model shown a previous chapter may
start continuing or borrowing from it instead of translating the current one. The
block header says so explicitly, the same way the revision pass is given the
source but forbidden to re-translate.
"""

from typing import Any, Callable, Dict, List, Optional, Tuple

from .extractor import strip_glossary_table
from .storage.chapters import chapter_num_float

# Ceiling on how much looked-up text may enter the prompt, whatever N says. One
# oversized chapter should never quietly blow up the context; the most recent
# chapters are kept and the rest dropped, with a note in the log.
DEFAULT_MAX_CHARS = 60_000

_HEADERS = {
    "english": (
        "# Previously Translated Chapters — Reference Only\n"
        "The chapters below are already finished. They are here so your voice, "
        "register, and terminology stay consistent with them.\n"
        "Do NOT continue them, summarize them, or copy sentences from them. "
        "Translate only the content given in the user message.\n"
    ),
    "indonesian": (
        "# Bab yang Sudah Diterjemahkan — Referensi Saja\n"
        "Bab-bab di bawah ini sudah selesai. Fungsinya agar suara narasi, register, "
        "dan terminologimu tetap konsisten dengan mereka.\n"
        "JANGAN melanjutkannya, meringkasnya, atau menyalin kalimat darinya. "
        "Terjemahkan HANYA konten yang ada di pesan user.\n"
    ),
}

_TERM_LABELS = {
    "english": "Terms established in this chapter:",
    "indonesian": "Istilah yang ditetapkan di bab ini:",
}


def _lang_key(target_language: str) -> str:
    lang = (target_language or "").strip().lower()
    return "indonesian" if lang.startswith("indonesia") else "english"


def _chapter_body(chapter: Dict[str, Any]) -> str:
    """Translated text without the appended glossary table.

    The table is not prose, and repeating one per looked-up chapter would fill the
    context with markup the model has no use for here.
    """
    return strip_glossary_table(chapter.get("translatedContent", "") or "").strip()


def _chapter_terms(chapter: Dict[str, Any], limit: int = 40) -> List[str]:
    entries = (chapter.get("glossaryUpdates") or {}).get("entries") or []
    out: List[str] = []
    for e in entries[:limit]:
        src = (e.get("sourceTerm") or "").strip()
        tgt = (e.get("translatedTerm") or "").strip()
        if src and tgt:
            out.append(f"{src} = {tgt}")
    return out


def select_lookup_chapters(
    chapters: List[Dict[str, Any]],
    current_chapter: Dict[str, Any],
    count: int,
) -> List[Dict[str, Any]]:
    """The `count` finished chapters immediately preceding the current one.

    Ordered by chapter number rather than creation time, so importing out of order
    or re-adding a chapter later cannot scramble the sequence. Chapters that are
    not translated yet are skipped rather than leaving a hole.
    """
    if count <= 0:
        return []

    current_num = chapter_num_float(current_chapter.get("chapterNumber"), default=0.0)
    current_id = current_chapter.get("id")

    previous = [
        ch for ch in chapters
        if ch.get("id") != current_id
        and chapter_num_float(ch.get("chapterNumber"), default=0.0) < current_num
        and _chapter_body(ch)
    ]
    previous.sort(key=lambda c: chapter_num_float(c.get("chapterNumber"), default=0.0))
    return previous[-count:]


def build_lookup_context(
    series: Dict[str, Any],
    chapters: List[Dict[str, Any]],
    current_chapter: Dict[str, Any],
    max_chars: int = DEFAULT_MAX_CHARS,
    log: Optional[Callable[[str], None]] = None,
) -> Tuple[str, List[str]]:
    """
    Returns (context_text, ids_of_chapters_included).

    The id list lets the caller keep rolling memory from summarising the same
    chapters that are already present here in full.
    """
    def _emit(msg: str):
        if callable(log):
            log(msg)

    if not series.get("lookupEnabled", False):
        return "", []

    try:
        count = int(series.get("lookupChapters", 1) or 0)
    except (TypeError, ValueError):
        count = 1
    if count <= 0:
        return "", []

    selected = select_lookup_chapters(chapters, current_chapter, count)
    if not selected:
        return "", []

    lang = _lang_key(series.get("targetLanguage", "English"))

    # Build newest-first so the character budget keeps the most relevant chapters,
    # then reverse for chronological reading order.
    kept: List[Dict[str, Any]] = []
    used = 0
    for ch in reversed(selected):
        body = _chapter_body(ch)
        if kept and used + len(body) > max_chars:
            break
        kept.append(ch)
        used += len(body)
    kept.reverse()

    if len(kept) < len(selected):
        _emit(
            f"[Look Up] Character budget reached — using {len(kept)} of "
            f"{len(selected)} requested chapter(s)"
        )

    parts: List[str] = [_HEADERS[lang]]
    for ch in kept:
        num = ch.get("chapterNumber", "?")
        title = (ch.get("title") or "").strip()
        heading = f"## Chapter {num}" + (f" — {title}" if title else "")
        parts.append(heading)
        parts.append(_chapter_body(ch))

        terms = _chapter_terms(ch)
        if terms:
            parts.append(_TERM_LABELS[lang] + "\n" + "\n".join(terms))

    context = "\n\n".join(parts) + "\n"
    _emit(
        f"[Look Up] {len(kept)} chapter(s), ~{len(context)} chars "
        f"(chapters {', '.join(str(c.get('chapterNumber', '?')) for c in kept)})"
    )

    return context, [c.get("id", "") for c in kept]
