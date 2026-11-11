"""
Agent Tools — the bounded toolkit an agent session works with.

The agent never sees or rewrites a whole chapter. It reads paragraphs and source
lines by index, and edits one paragraph at a time through guarded operations:

    - the translation is archived (version history) before the first edit
      to a chapter, so every agent change can be rolled back from the UI
    - edits may not introduce Japanese/CJK letters
    - edits may not remove an illustration placeholder
    - a replacement that throws away most of a long paragraph is refused
      (that is how a "fix" silently deletes content)
    - deletions are capped per session

The trailing glossary table is never exposed or touched; edits are applied to
the body and the table is re-appended unchanged.
"""

import json
import re
from typing import Any, Callable, Dict, List, Optional

from .chapter_check import check_chapter, is_scene_marker, split_paragraphs, volume_name_variants
from .extractor import strip_glossary_table
from .placeholder import is_placeholder_line, collect_placeholder_filenames
from .storage.chapters import (
    get_chapter, update_chapter_translation, archive_current_translation,
)
from .storage.series import get_series, add_glossary_entry

_CJK_LETTER = re.compile(r'[぀-ヿ㐀-䶿一-鿿가-힯]')

MAX_RESULT_CHARS = 6000
MAX_DELETES_PER_SESSION = 6
# A replacement shorter than this share of a long original is refused.
MIN_REPLACE_RATIO = 0.35
LONG_PARAGRAPH = 160


def _clip(text: str, limit: int = MAX_RESULT_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n…[truncated {len(text) - limit} chars — request a smaller range]"


class _ChapterState:
    """Working copy of one chapter: body paragraphs + untouched glossary tail."""

    def __init__(self, chapter: Dict[str, Any]):
        self.id = chapter["id"]
        self.number = str(chapter.get("chapterNumber", "?"))
        self.title = chapter.get("title", "")
        self.raw = chapter.get("rawContent", "") or ""
        self.raw_lines = self.raw.split("\n")
        full = chapter.get("translatedContent", "") or ""
        body = strip_glossary_table(full)
        if body and full.startswith(body) and len(body) < len(full):
            self.tail = full[len(body):]
        else:
            body, self.tail = full, ""
        self.paras = split_paragraphs(body)
        self.archived = False
        self.edits = 0

    def text(self) -> str:
        body = "\n\n".join(self.paras)
        if self.tail:
            return body.rstrip() + "\n\n" + self.tail.lstrip("\n")
        return body

    def source_window(self, para_index: int) -> int:
        """Approximate raw line for a paragraph, by cumulative character position."""
        if not self.paras or not self.raw_lines:
            return 0
        before = sum(len(p) for p in self.paras[:max(para_index, 0)])
        total = sum(len(p) for p in self.paras) or 1
        target = int(len(self.raw) * before / total)
        pos = 0
        for i, ln in enumerate(self.raw_lines):
            pos += len(ln) + 1
            if pos >= target:
                return i
        return len(self.raw_lines) - 1


class AgentToolkit:
    """
    Tools for one agent session.

    mode="chapter": edits are limited to `focus_chapter_id`; other chapters are read-only.
    mode="volume":  edits may target any chapter in the run.
    """

    def __init__(
        self,
        series_id: str,
        chapter_ids: List[str],
        mode: str = "chapter",
        focus_chapter_id: str = "",
        log: Optional[Callable[[str], None]] = None,
    ):
        self.series_id = series_id
        self.chapter_ids = list(chapter_ids)
        self.mode = mode
        self.focus_id = focus_chapter_id
        self._log = log or (lambda m: None)
        self._states: Dict[str, _ChapterState] = {}
        self.deletes = 0
        self.finished = False
        self.finish_summary = ""
        self.edit_log: List[Dict[str, Any]] = []
        self.glossary_added: List[str] = []
        series = get_series(series_id) or {}
        self.target_language = series.get("targetLanguage", "English")

    # ------------------------------------------------------------------ helpers

    def _resolve(self, chapter: Any) -> _ChapterState:
        """`chapter` is the 1-based position in the run, or omitted for the focus chapter."""
        if chapter in (None, "", 0) and self.focus_id:
            cid = self.focus_id
        else:
            try:
                pos = int(chapter)
            except (TypeError, ValueError):
                raise ValueError(f"chapter must be a position number 1..{len(self.chapter_ids)}")
            if not 1 <= pos <= len(self.chapter_ids):
                raise ValueError(f"chapter {pos} out of range 1..{len(self.chapter_ids)}")
            cid = self.chapter_ids[pos - 1]
        if cid not in self._states:
            ch = get_chapter(self.series_id, cid)
            if not ch:
                raise ValueError("chapter not found")
            self._states[cid] = _ChapterState(ch)
        return self._states[cid]

    def _position(self, cid: str) -> int:
        return self.chapter_ids.index(cid) + 1 if cid in self.chapter_ids else 0

    def _check_editable(self, st: _ChapterState):
        if self.mode == "chapter" and st.id != self.focus_id:
            raise ValueError("this session may only edit the chapter under review")

    def _persist(self, st: _ChapterState):
        if not st.archived:
            try:
                archive_current_translation(self.series_id, st.id)
            except Exception as e:
                self._log(f"[Agent] Archive failed (continuing): {e}")
            st.archived = True
        update_chapter_translation(self.series_id, st.id, st.text())
        st.edits += 1

    def _validate_new_text(self, new_text: str, old_text: str = "") -> str:
        new_text = (new_text or "").strip()
        if not new_text:
            raise ValueError("new text is empty — use delete_paragraph to remove a paragraph")
        if _CJK_LETTER.search(new_text) or "「" in new_text or "」" in new_text:
            raise ValueError("new text contains Japanese characters — translate them")
        if "**" in new_text:
            raise ValueError("bold markup is not allowed")
        lost = [f for f in collect_placeholder_filenames(old_text) if f not in collect_placeholder_filenames(new_text)]
        if lost:
            raise ValueError(f"new text drops illustration placeholder(s): {', '.join(lost)}")
        if len(old_text) >= LONG_PARAGRAPH and len(new_text) < len(old_text) * MIN_REPLACE_RATIO:
            raise ValueError(
                f"replacement is {len(new_text)} chars for a {len(old_text)}-char paragraph — "
                "that would drop content. Rewrite the whole paragraph, not a fragment.")
        return new_text

    def _check_duplicates(self, st: _ChapterState, parts: List[str], skip: int = -1):
        """Refuse an edit that would create a copy of a paragraph that already exists."""
        existing = {p.strip(): j for j, p in enumerate(st.paras) if j != skip}
        for part in parts:
            key = part.strip()
            if len(key) >= 40 and key in existing:
                raise ValueError(f"that text already exists as paragraph {existing[key]} — "
                                 "editing it in would duplicate it. Fix paragraph "
                                 f"{existing[key]} instead, or delete the copy")

    def _fmt_paras(self, st: _ChapterState, start: int, count: int) -> str:
        start = max(0, start)
        end = min(len(st.paras), start + max(1, count))
        lines = [f"[{i}] {st.paras[i]}" for i in range(start, end)]
        head = f"Chapter {self._position(st.id)} (#{st.number}) paragraphs {start}–{end - 1} of {len(st.paras)}"
        return head + "\n" + "\n\n".join(lines)

    # ------------------------------------------------------------------ tools

    def list_chapters(self) -> str:
        out = []
        for i, cid in enumerate(self.chapter_ids, 1):
            ch = get_chapter(self.series_id, cid) or {}
            body = strip_glossary_table(ch.get("translatedContent", "") or "")
            out.append(f"{i}. #{ch.get('chapterNumber', '?')} {ch.get('title', '')} — "
                       f"{ch.get('status', '?')}, {len(split_paragraphs(body))} paragraphs")
        return "\n".join(out)

    def get_findings(self, chapter: Any = None) -> str:
        st = self._resolve(chapter)
        series = get_series(self.series_id) or {}
        report = check_chapter(st.raw, st.text(), series.get("glossary") or [], self.target_language)
        if not report["findings"]:
            return f"No findings. Stats: {json.dumps(report['stats'])}"
        lines = [f"Stats: {json.dumps(report['stats'])}"]
        lows = [f for f in report["findings"] if f["severity"] == "low"]
        shown = [f for f in report["findings"] if f["severity"] != "low"] + lows[:25]
        for f in shown:
            loc = f"para {f['para']} (≈source line {st.source_window(f['para'])})" if f["para"] is not None else "chapter-level"
            lines.append(f"- [{f['severity']}] {f['type']} @ {loc}: {f['detail']}"
                         + (f"\n    “{f['text']}”" if f.get("text") else ""))
        if len(lows) > 25:
            lines.append(f"(+{len(lows) - 25} more low findings not shown)")
        return _clip("\n".join(lines))

    def read_translation(self, start: int = 0, count: int = 20, chapter: Any = None) -> str:
        st = self._resolve(chapter)
        return _clip(self._fmt_paras(st, int(start), min(int(count), 25)))

    def read_source(self, start_line: int = 0, count: int = 40, chapter: Any = None, around_para: Any = None) -> str:
        st = self._resolve(chapter)
        if around_para is not None:
            start_line = max(0, st.source_window(int(around_para)) - 15)
        start_line = max(0, int(start_line))
        end = min(len(st.raw_lines), start_line + min(int(count), 50))
        lines = [f"L{i}: {st.raw_lines[i]}" for i in range(start_line, end) if st.raw_lines[i].strip()]
        return _clip(f"Source lines {start_line}–{end - 1} of {len(st.raw_lines)}\n" + "\n".join(lines))

    def search_source(self, query: str, chapter: Any = None) -> str:
        st = self._resolve(chapter)
        q = (query or "").strip()
        if not q:
            raise ValueError("query is empty")
        hits = [f"L{i}: {ln.strip()[:200]}" for i, ln in enumerate(st.raw_lines) if q in ln]
        return _clip(f"{len(hits)} source line(s) contain “{q}”\n" + "\n".join(hits[:60]))

    def search_translation(self, query: str, chapter: Any = None) -> str:
        """Case-insensitive search. Without `chapter` in volume mode, searches every chapter."""
        q = (query or "").strip().lower()
        if not q:
            raise ValueError("query is empty")
        if chapter in (None, "", 0) and self.mode == "volume":
            targets = [self._resolve(i) for i in range(1, len(self.chapter_ids) + 1)]
        else:
            targets = [self._resolve(chapter)]
        out = []
        for st in targets:
            for i, p in enumerate(st.paras):
                if q in p.lower():
                    out.append(f"ch {self._position(st.id)} [{i}] {p[:220]}")
        return _clip(f"{len(out)} paragraph(s) contain “{query}”\n" + "\n".join(out[:80]))

    def name_variants(self) -> str:
        texts = []
        for i in range(1, len(self.chapter_ids) + 1):
            texts.append("\n\n".join(self._resolve(i).paras))
        groups = volume_name_variants(texts)
        if not groups:
            return "No long-vowel spelling variants found."
        return "\n".join(json.dumps(g["forms"], ensure_ascii=False) for g in groups[:40])

    def volume_report(self) -> str:
        from .qa_scan import scan_series, compact_volume_report
        return compact_volume_report(scan_series(self.series_id, include_low=False))

    def glossary_lookup(self, query: str = "") -> str:
        series = get_series(self.series_id) or {}
        q = (query or "").strip().lower()
        rows = []
        for e in series.get("glossary") or []:
            line = f"{e.get('sourceTerm', '')} === {e.get('translatedTerm', '')} === {e.get('notes', '')}"
            if not q or q in line.lower():
                rows.append(line)
        return _clip(f"{len(rows)} entr(ies)\n" + "\n".join(rows[:150]))

    def glossary_add(self, source_term: str, translated_term: str, note: str = "") -> str:
        src = (source_term or "").strip()
        tgt = (translated_term or "").strip()
        if not src or not tgt:
            raise ValueError("source_term and translated_term are required")
        if _CJK_LETTER.search(tgt):
            raise ValueError("translated_term must not contain Japanese characters")
        series = get_series(self.series_id) or {}
        for e in series.get("glossary") or []:
            if (e.get("sourceTerm") or "").strip().lower() == src.lower():
                return f"Already in glossary: {e.get('sourceTerm')} === {e.get('translatedTerm')} (not changed)"
        from .glossary_guard import find_conflict
        conflict = find_conflict(src, tgt, series.get("glossary") or [])
        if conflict:
            raise ValueError(f"contradicts {conflict.get('sourceTerm')} === {conflict.get('translatedTerm')} — "
                             "a part of a name must use the words of the full name")
        add_glossary_entry(self.series_id, src, tgt, note or "")
        self.glossary_added.append(f"{src} → {tgt}")
        self._log(f"[Agent] Glossary + {src} → {tgt}")
        return f"Added: {src} === {tgt} === {note}"

    def replace_paragraph(self, index: int, new_text: str, reason: str = "", chapter: Any = None) -> str:
        st = self._resolve(chapter)
        self._check_editable(st)
        i = int(index)
        if not 0 <= i < len(st.paras):
            raise ValueError(f"index {i} out of range 0..{len(st.paras) - 1}")
        old = st.paras[i]
        if is_placeholder_line(old):
            raise ValueError("that paragraph is an illustration placeholder — leave it")
        if is_scene_marker(old):
            raise ValueError("that paragraph is a scene marker — markers mirror the source, leave it")
        new = self._validate_new_text(new_text, old)
        if new == old:
            return "No change (text identical)."
        # A replacement may split one paragraph into several (e.g. two speakers merged).
        parts = split_paragraphs(new)
        self._check_duplicates(st, parts, skip=i)
        st.paras[i:i + 1] = parts
        self._persist(st)
        self.edit_log.append({"chapter": st.number, "op": "replace", "para": i, "reason": reason,
                              "before": old[:200], "after": new[:200]})
        self._log(f"[Agent] ch#{st.number} replace [{i}] — {reason[:100]}")
        shift = f" (now {len(parts)} paragraphs; later indices shifted by {len(parts) - 1})" if len(parts) > 1 else ""
        return f"Replaced paragraph {i}{shift}."

    def insert_paragraph(self, after_index: int, text: str, reason: str = "", chapter: Any = None) -> str:
        st = self._resolve(chapter)
        self._check_editable(st)
        i = int(after_index)
        if not -1 <= i < len(st.paras):
            raise ValueError(f"after_index must be -1..{len(st.paras) - 1}")
        new = self._validate_new_text(text)
        parts = split_paragraphs(new)
        self._check_duplicates(st, parts)
        st.paras[i + 1:i + 1] = parts
        self._persist(st)
        self.edit_log.append({"chapter": st.number, "op": "insert", "para": i + 1, "reason": reason,
                              "after": new[:200]})
        self._log(f"[Agent] ch#{st.number} insert after [{i}] — {reason[:100]}")
        return f"Inserted {len(parts)} paragraph(s) at index {i + 1}; later indices shifted by {len(parts)}."

    def delete_paragraph(self, index: int, reason: str = "", chapter: Any = None) -> str:
        st = self._resolve(chapter)
        self._check_editable(st)
        if self.deletes >= MAX_DELETES_PER_SESSION:
            raise ValueError("delete limit for this session reached — fix by replacing instead")
        i = int(index)
        if not 0 <= i < len(st.paras):
            raise ValueError(f"index {i} out of range 0..{len(st.paras) - 1}")
        old = st.paras[i]
        if is_placeholder_line(old):
            raise ValueError("that paragraph is an illustration placeholder — leave it")
        if is_scene_marker(old):
            raise ValueError("that paragraph is a scene marker — markers mirror the source, leave it")
        if not reason.strip():
            raise ValueError("reason is required for a deletion")
        del st.paras[i]
        self.deletes += 1
        self._persist(st)
        self.edit_log.append({"chapter": st.number, "op": "delete", "para": i, "reason": reason, "before": old[:200]})
        self._log(f"[Agent] ch#{st.number} delete [{i}] — {reason[:100]}")
        return f"Deleted paragraph {i}; later indices shifted by -1."

    def finish(self, summary: str = "") -> str:
        self.finished = True
        self.finish_summary = (summary or "").strip()
        return "Session closed."

    # ------------------------------------------------------------------ schema / dispatch

    def schemas(self) -> List[Dict[str, Any]]:
        ch_param = {"chapter": {"type": "integer",
                                "description": "Chapter position from list_chapters (1-based). "
                                               "Omit for the chapter under review."}}
        if self.mode == "volume":
            ch_param["chapter"]["description"] = "Chapter position from list_chapters (1-based)."

        def obj(props: Dict[str, Any], required: List[str]) -> Dict[str, Any]:
            return {"type": "object", "properties": props, "required": required}

        tools = [
            {"name": "list_chapters", "description": "List the chapters in this run with their positions.",
             "parameters": obj({}, [])},
            {"name": "get_findings",
             "description": "Run the deterministic checker on a chapter. Re-run after fixing to confirm.",
             "parameters": obj(dict(ch_param), [])},
            {"name": "read_translation", "description": "Read translated paragraphs by index (max 60).",
             "parameters": obj({"start": {"type": "integer"}, "count": {"type": "integer"}, **ch_param}, ["start"])},
            {"name": "read_source",
             "description": "Read source (raw) lines. Pass around_para to jump to the source near a translated paragraph.",
             "parameters": obj({"start_line": {"type": "integer"}, "count": {"type": "integer"},
                                "around_para": {"type": "integer"}, **ch_param}, [])},
            {"name": "search_source", "description": "Find source lines containing an exact string.",
             "parameters": obj({"query": {"type": "string"}, **ch_param}, ["query"])},
            {"name": "search_translation",
             "description": "Case-insensitive search of translated paragraphs"
                            + (" (all chapters when chapter is omitted)." if self.mode == "volume" else "."),
             "parameters": obj({"query": {"type": "string"}, **ch_param}, ["query"])},
            {"name": "glossary_lookup", "description": "Search the series glossary (empty query lists all).",
             "parameters": obj({"query": {"type": "string"}}, [])},
            {"name": "glossary_add",
             "description": "Lock a new term. Only for names/terms that recur and are missing from the glossary. "
                            "source_term must be in the source script.",
             "parameters": obj({"source_term": {"type": "string"}, "translated_term": {"type": "string"},
                                "note": {"type": "string"}}, ["source_term", "translated_term"])},
            {"name": "replace_paragraph",
             "description": "Replace one paragraph with corrected text. Blank lines inside new_text split it "
                            "into several paragraphs (e.g. to separate two speakers).",
             "parameters": obj({"index": {"type": "integer"}, "new_text": {"type": "string"},
                                "reason": {"type": "string"}, **ch_param}, ["index", "new_text", "reason"])},
            {"name": "insert_paragraph",
             "description": "Insert translated text for content the translation dropped. after_index=-1 inserts at the top.",
             "parameters": obj({"after_index": {"type": "integer"}, "text": {"type": "string"},
                                "reason": {"type": "string"}, **ch_param}, ["after_index", "text", "reason"])},
            {"name": "delete_paragraph",
             "description": "Delete a paragraph that is duplicated or not in the source. Limited per session.",
             "parameters": obj({"index": {"type": "integer"}, "reason": {"type": "string"}, **ch_param},
                               ["index", "reason"])},
            {"name": "finish", "description": "End the session with a short summary of what was fixed and what was left.",
             "parameters": obj({"summary": {"type": "string"}}, ["summary"])},
        ]
        if self.mode == "volume":
            tools.insert(2, {"name": "volume_report",
                             "description": "Deterministic QA digest of the whole volume: name variants with "
                                            "chapters, non-standard spelling, quote style, length outliers, "
                                            "glossary issues, frequent words.",
                             "parameters": obj({}, [])})
            tools.insert(2, {"name": "name_variants",
                             "description": "Capitalised names that appear in several long-vowel spellings across the volume.",
                             "parameters": obj({}, [])})
        return tools

    def call(self, name: str, args: Dict[str, Any]) -> str:
        if "__raw__" in args:
            return f"ERROR: arguments were not valid JSON: {str(args['__raw__'])[:200]}"
        fn = getattr(self, name, None)
        allowed = {t["name"] for t in self.schemas()}
        if name not in allowed or not callable(fn):
            return f"ERROR: unknown tool '{name}'"
        try:
            return fn(**args)
        except TypeError as e:
            return f"ERROR: bad arguments for {name}: {e}"
        except Exception as e:
            return f"ERROR: {e}"
