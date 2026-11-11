"""
QA Chapter Review — look at one chapter's findings in context and fix them in place.

The chapter workspace shows a translation read-only, so jumping there from the QA
report leads nowhere. This module backs a review view inside the report:

    chapter_detail     every paragraph, every finding, the source lines each
                       paragraph most likely came from, and a ready preview for
                       findings a safe fix can repair
    update_paragraph   replace or delete one paragraph (archived first, guarded
                       against editing a stale view)
    suggest_fix        one model call: the paragraph, its source, the finding →
                       a corrected paragraph for the user to accept or edit

Paragraph indices match chapter_check: the translated body split on blank lines,
glossary table excluded.
"""

from typing import Any, Callable, Dict, List, Optional

from .agent_tools import _ChapterState
from .chapter_check import check_chapter, dialogue_alignment_gaps, lang_code, source_code
from .placeholder import is_placeholder_line
from .prompt_builder import filter_glossary_by_content, build_glossary_table
from .qa_fix import apply_safe_fixes
from .storage.chapters import get_chapter, update_chapter_translation, archive_current_translation
from .storage.series import get_series

_WINDOW_BEFORE = 6
_WINDOW_AFTER = 14
_MAX_SPAN = 40


def _source_map(st: _ChapterState, src: str = "jp") -> List[List[int]]:
    """
    [start, end] source line range per paragraph.

    Dialogue-aligned gaps give exact ranges where the dialogue counts match;
    elsewhere the position is estimated from cumulative length.
    """
    n = len(st.paras)
    out: List[Optional[List[int]]] = [None] * n
    for g in dialogue_alignment_gaps(st.raw_lines, st.paras, src):
        for p in range(g["para_start"], min(g["para_end"], n - 1) + 1):
            start = g["src_start"]
            end = min(g["src_end"], start + _MAX_SPAN)
            out[p] = [start, end]
    last = max(len(st.raw_lines) - 1, 0)
    for p in range(n):
        if out[p] is None:
            mid = st.source_window(p)
            out[p] = [max(0, mid - _WINDOW_BEFORE), min(last, mid + _WINDOW_AFTER)]
    return out  # type: ignore[return-value]


def _load(series_id: str, chapter_id: str):
    series = get_series(series_id)
    chapter = get_chapter(series_id, chapter_id)
    if not series or not chapter:
        raise ValueError("Series atau bab tidak ditemukan")
    return series, chapter, _ChapterState(chapter)


def chapter_detail(series_id: str, chapter_id: str) -> Dict[str, Any]:
    series, chapter, st = _load(series_id, chapter_id)
    target = series.get("targetLanguage", "English")
    source = series.get("sourceLanguage", "Japanese")
    report = check_chapter(st.raw, st.text(), series.get("glossary") or [], target, source, st.table_entries)

    findings = []
    for f in report["findings"]:
        item = dict(f)
        if f.get("fix") and f.get("para") is not None and 0 <= f["para"] < len(st.paras):
            # Preview the safe fix on this paragraph alone; style-dependent fixes
            # (quote style) still see the whole chapter.
            fixed, changes = apply_safe_fixes(st.text(), [f["fix"]], target, source)
            mine = [c for c in changes if c["para"] == f["para"]]
            if mine:
                fixed_paras = _ChapterState({**chapter, "translatedContent": fixed}).paras
                if f["para"] < len(fixed_paras):
                    item["fixPreview"] = fixed_paras[f["para"]]
        findings.append(item)

    return {
        "chapterId": chapter["id"],
        "chapterNumber": str(chapter.get("chapterNumber", "?")),
        "title": chapter.get("title", ""),
        "paragraphs": st.paras,
        "source": st.raw_lines,
        "sourceMap": _source_map(st),
        "findings": findings,
        "stats": report["stats"],
    }


def update_paragraph(series_id: str, chapter_id: str, index: int, expected: str,
                     new_text: str, archive: bool = True) -> Dict[str, Any]:
    """
    Replace paragraph `index` with `new_text` (blank lines split it; empty deletes it).

    `expected` is the paragraph as the user saw it — a mismatch means the chapter
    changed underneath the view, and the edit is refused rather than misplaced.
    """
    _, _, st = _load(series_id, chapter_id)
    i = int(index)
    if not 0 <= i < len(st.paras):
        raise ValueError("Paragraf tidak ditemukan — muat ulang tampilan")
    if st.paras[i].strip() != (expected or "").strip():
        raise ValueError("Paragraf sudah berubah sejak ditampilkan — muat ulang tampilan")
    if is_placeholder_line(st.paras[i]) and (new_text or "").strip() != st.paras[i].strip():
        raise ValueError("Baris placeholder ilustrasi tidak boleh diubah")

    parts = [p.strip() for p in (new_text or "").split("\n\n") if p.strip()]
    st.paras[i:i + 1] = parts
    if archive:
        archive_current_translation(series_id, chapter_id)
    update_chapter_translation(series_id, chapter_id, st.text())
    return chapter_detail(series_id, chapter_id)


_SUGGEST_SYSTEM = """You fix one paragraph of a {target} light-novel translation of a {source} source.

You receive the paragraph, the source lines it was translated from, and the problem a checker found.
Return the corrected paragraph only — no quotes around it, no commentary, no notes.

Rules:
- Fix the problem; keep everything else as it is (wording, voice, register).
- Write in {target}. No {source} characters may remain.
- Keep honorifics and retained terms (-san, -kun, onii-chan, fufu) and the glossary renderings below.
- One line of dialogue is one paragraph: if two speakers share the paragraph, separate them with a blank line.
- Italic with *asterisks* only; never bold.
- If the problem is content missing from the translation, add the missing sentences translated from the source.
- If the paragraph should not exist (a duplicate), return exactly: DELETE"""


def suggest_fix(client, series_id: str, chapter_id: str, index: int,
                log: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
    series, chapter, st = _load(series_id, chapter_id)
    i = int(index)
    if not 0 <= i < len(st.paras):
        raise ValueError("Paragraf tidak ditemukan")
    target = series.get("targetLanguage", "English")
    source = series.get("sourceLanguage", "Japanese")
    report = check_chapter(st.raw, st.text(), series.get("glossary") or [], target, source, st.table_entries)
    problems = [f for f in report["findings"] if f.get("para") == i]
    a, b = _source_map(st, source_code(source))[i]
    source = "\n".join(st.raw_lines[a:b + 1])
    glossary = filter_glossary_by_content(series.get("glossary") or [], source)

    neighbours = []
    if i > 0:
        neighbours.append(f"(previous paragraph) {st.paras[i - 1]}")
    if i + 1 < len(st.paras):
        neighbours.append(f"(next paragraph) {st.paras[i + 1]}")

    user = (
        "PROBLEM:\n" + ("\n".join(f"- {p['type']}: {p['detail']}" for p in problems) or "- (reviewer asked for a check)")
        + f"\n\nSOURCE (lines {a}–{b}):\n{source}\n\n"
        + ("GLOSSARY:\n" + build_glossary_table(glossary) + "\n" if glossary else "")
        + ("CONTEXT:\n" + "\n".join(neighbours) + "\n\n" if neighbours else "")
        + f"PARAGRAPH TO FIX:\n{st.paras[i]}"
    )
    system = _SUGGEST_SYSTEM.format(target=target, source=series.get("sourceLanguage", "Japanese"))
    response = client.complete(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        stream=False, max_tokens=4000,
    )
    text = ""
    try:
        text = response.choices[0].message.content or ""
    except Exception:
        text = ""
    text = text.strip().strip("`").strip()
    if not text:
        raise ValueError("Model tidak mengembalikan saran")
    return {"index": i, "suggestion": "" if text == "DELETE" else text, "delete": text == "DELETE",
            "language": lang_code(target)}
