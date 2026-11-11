"""
Agent Run — autonomous translate → review → repair loop over a whole series.

Control flow is owned by code, not by the model:

    for each chapter (in import order):
        translate it if it is not done yet (retrying transient failures)
        auto-apply its glossary terms so the next chapter sees them
        run a review session: an agent with tools reads the checker findings,
            verifies them against the source and repairs the translation
        record the review on the chapter (resume skips reviewed chapters)
    then one volume session for cross-chapter consistency (names, terms)

The model cannot end the run early or skip a chapter; its agency lives inside
each review session. Every edit goes through AgentToolkit's guards and the
previous translation is archived first, so all agent changes are reversible
from the chapter's version history.

Models without tool calling fall back to a single-shot JSON repair per chapter.
"""

import json
import re
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from .agent_tools import AgentToolkit
from .chapter_check import check_chapter
from .prompt_builder import build_system_prompt, is_blank_prompt
from .storage.chapters import get_chapter, get_chapters, update_chapter_fields
from .storage.series import get_series

# Turn budgets. A review that has not converged by then is wandering, not
# finding more — the July run hit 30 on half its chapters with few edits.
CHAPTER_MAX_STEPS = 16
FINDINGS_MAX_STEPS = 12
VOLUME_MAX_STEPS = 24
BUDGET_WARNING_AT = 3
AGENT_MAX_TOKENS = 16000
TRANSLATE_ATTEMPTS = 3
# Rough budget for the conversation before old tool results are trimmed.
HISTORY_CHAR_BUDGET = 150_000
RULES_CHAR_LIMIT = 24_000

REVIEW_FINDINGS = "findings"   # review only chapters the checker flags (high/medium)
REVIEW_FULL = "full"           # review every chapter, with a source cross-check


class ToolsUnsupported(Exception):
    pass


def _looks_like_tools_unsupported(err: Exception) -> bool:
    msg = str(err).lower()
    return any(k in msg for k in ("tool", "function call", "function_call", "functions are not supported"))


# ---------------------------------------------------------------------------
# One agent session
# ---------------------------------------------------------------------------

def _trim_history(messages: List[Dict[str, Any]]):
    """Blank out the oldest tool results once the conversation grows too large."""
    total = sum(len(str(m.get("content") or "")) for m in messages)
    if total <= HISTORY_CHAR_BUDGET:
        return
    tool_idx = [i for i, m in enumerate(messages) if m.get("role") == "tool"]
    for i in tool_idx[:-6]:
        content = messages[i].get("content") or ""
        if len(content) > 200:
            total -= len(content)
            messages[i]["content"] = "[older tool result trimmed — call the tool again if needed]"
            if total <= HISTORY_CHAR_BUDGET:
                break


def run_session(
    client,
    toolkit: AgentToolkit,
    system_prompt: str,
    task: str,
    max_steps: int,
    is_cancelled: Callable[[], bool],
    log: Callable[[str], None],
) -> Dict[str, Any]:
    """Run tool-calling turns until the agent calls finish, stalls, or hits max_steps."""
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task},
    ]
    tools = toolkit.schemas()
    idle_turns = 0
    steps = 0

    while steps < max_steps and not toolkit.finished:
        if is_cancelled():
            break
        steps += 1
        _trim_history(messages)
        try:
            resp = client.chat_with_tools(messages, tools, max_tokens=AGENT_MAX_TOKENS)
        except Exception as e:
            if steps == 1 and _looks_like_tools_unsupported(e):
                raise ToolsUnsupported(str(e))
            log(f"[Agent] Turn failed: {e}")
            # One retry after a pause for transient network/provider errors.
            time.sleep(10)
            if is_cancelled():
                break
            resp = client.chat_with_tools(messages, tools, max_tokens=AGENT_MAX_TOKENS)

        messages.append(resp["assistant_message"])
        if resp.get("content") and resp["content"].strip():
            log(f"[Agent] {resp['content'].strip()[:300]}")

        if not resp["tool_calls"]:
            idle_turns += 1
            if idle_turns > 2:
                log("[Agent] No tool calls for 3 turns — closing session")
                break
            messages.append({"role": "user", "content":
                             "Keep working with the tools. When every finding is handled, call finish."})
            continue
        idle_turns = 0

        left = max_steps - steps
        for n, call in enumerate(resp["tool_calls"]):
            result = toolkit.call(call["name"], call["arguments"])
            if result.startswith("ERROR"):
                log(f"[Agent] {call['name']} → {result[:200]}")
            # Budget reminder rides on the last tool result (a separate user turn
            # would break strict role alternation on some providers).
            if n == len(resp["tool_calls"]) - 1 and 0 < left <= BUDGET_WARNING_AT and not toolkit.finished:
                result += (f"\n\n[Budget] {left} turn(s) left. Make your remaining fixes now and call finish.")
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})

    return {
        "steps": steps,
        "finished": toolkit.finished,
        "summary": toolkit.finish_summary,
        "edits": list(toolkit.edit_log),
        "glossaryAdded": list(toolkit.glossary_added),
    }


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def _rules_reference(series: Dict[str, Any], raw_content: str) -> str:
    """The rulebook the translator worked under, minus nothing — truncated if huge."""
    try:
        rules = build_system_prompt(series, raw_content=raw_content, pre_filter=True)
    except Exception:
        rules = ""
    if len(rules) > RULES_CHAR_LIMIT:
        rules = rules[:RULES_CHAR_LIMIT] + "\n…[rules truncated]"
    return rules


def _brief_block(brief: str) -> str:
    brief = (brief or "").strip()
    if not brief or is_blank_prompt(brief):
        return ""
    return f"\n\n## Brief from the user (standing instruction for this run)\n{brief}"


def _chapter_system_prompt(series: Dict[str, Any], raw: str, brief: str) -> str:
    src = series.get("sourceLanguage", "Japanese")
    tgt = series.get("targetLanguage", "English")
    return f"""You are the reviewing editor in an autonomous light-novel translation pipeline ({src} → {tgt}).
Another model has already translated the chapter. You repair it with tools; you never retranslate it wholesale.

You have a budget of about {CHAPTER_MAX_STEPS} turns. Several tool calls may go in one turn — batch
reads together. Do not read the whole chapter; go where the task points you.

How to work:
1. Call get_findings first.
2. For every high and medium finding: read the paragraph (read_translation) and the source near it
   (read_source with around_para), decide whether it is a real defect, and fix it. Chapter-level
   findings (dialogue_coverage, scene_marker_count, missing_placeholder) mean content is missing or
   merged — compare source and translation section by section to locate the gap, then insert or split.
3. Low findings: fix only when the source confirms a real problem.
4. Call get_findings again to confirm, then call finish with a short summary.

Rules for edits:
- Fix what is wrong; do not restyle what is right. Keep the translator's voice and word choices.
- Every edit is written in {tgt}, follows the translation rules below and the locked glossary.
- One line of dialogue is one paragraph. Scene markers mirror the source.
- Never leave {src} characters in the text. Never touch illustration placeholder lines.
- If a finding is a false positive, leave it and mention it in the finish summary.{_brief_block(brief)}

## Translation rules the translator worked under (reference)
{_rules_reference(series, raw)}"""


def _review_hotspots(chapter: Dict[str, Any], limit: int = 3) -> List[str]:
    """
    Places worth a source cross-check, chosen by code so the agent does not wander.

    Prefers the dialogue-aligned gaps whose translation is shortest relative to its
    source (where dropped sentences hide), then the chapter ending.
    """
    from .chapter_check import dialogue_alignment_gaps, split_paragraphs
    from .extractor import strip_glossary_table

    raw_lines = (chapter.get("rawContent") or "").split("\n")
    paras = split_paragraphs(strip_glossary_table(chapter.get("translatedContent") or ""))
    spots: List[str] = []
    gaps = [g for g in dialogue_alignment_gaps(raw_lines, paras) if g["src_chars"] >= 150]
    if gaps:
        overall = sum(g["tr_chars"] for g in gaps) / max(sum(g["src_chars"] for g in gaps), 1)
        gaps = [g for g in gaps if g["tr_chars"] / max(g["src_chars"], 1) < 0.8 * overall]
    gaps.sort(key=lambda g: g["tr_chars"] / max(g["src_chars"], 1))
    for g in gaps[:limit - 1] if gaps else []:
        spots.append(f"paragraphs {g['para_start']}–{g['para_end']} ↔ source lines {g['src_start']}–{g['src_end']} "
                     f"(translation is short for its source: {g['tr_chars']} vs {g['src_chars']} chars)")
    if not gaps and paras:
        mid = len(paras) // 2
        spots.append(f"paragraphs {mid}–{min(mid + 8, len(paras) - 1)} (use read_source around_para={mid})")
    if paras:
        start = max(0, len(paras) - 8)
        spots.append(f"paragraphs {start}–{len(paras) - 1} ↔ the last ~30 source lines (chapter ending)")
    return spots


def _chapter_task(position: int, total: int, chapter: Dict[str, Any], full_review: bool) -> str:
    task = (f"Review chapter {position} of {total}: #{chapter.get('chapterNumber', '?')} "
            f"{chapter.get('title', '')}.")
    if full_review:
        spots = _review_hotspots(chapter)
        if spots:
            task += ("\nAfter handling the findings, cross-check ONLY these places against the source for omitted "
                     "sentences, wrong speakers and meaning drift, and fix what you find:\n"
                     + "\n".join(f"- {s}" for s in spots))
    return task


def _volume_system_prompt(series: Dict[str, Any], brief: str) -> str:
    tgt = series.get("targetLanguage", "English")
    return f"""You are the final editor for a translated light-novel volume ({tgt}). Every chapter is
already translated and reviewed individually. Your job is cross-chapter consistency only.

How to work:
1. list_chapters, then volume_report (deterministic QA digest) and glossary_lookup.
2. For each name or term that appears in more than one spelling, decide the correct form (the glossary
   wins; otherwise the majority form that matches the source), then search_translation and fix every
   stray occurrence with replace_paragraph (chapter = its position).
3. Chapters the report marks as length outliers ("short") may have lost content: compare their
   source and translation with read_source / read_translation and insert what is missing.
4. Recurring names or terms missing from the glossary: add them with glossary_add.
5. Call finish with a summary.

Rules: change only the inconsistent words inside a paragraph — rewrite nothing else.{_brief_block(brief)}"""


# ---------------------------------------------------------------------------
# Fallback for models without tool calling
# ---------------------------------------------------------------------------

def _single_shot_repair(
    complete_text: Callable[[List[Dict[str, str]]], str],
    toolkit: AgentToolkit,
    series: Dict[str, Any],
    log: Callable[[str], None],
) -> Dict[str, Any]:
    st = toolkit._resolve(None)
    report = check_chapter(st.raw, st.text(), series.get("glossary") or [], toolkit.target_language)
    targets = [f for f in report["findings"] if f["severity"] in ("high", "medium") and f["para"] is not None]
    if not targets:
        return {"steps": 0, "finished": True, "summary": "No paragraph-level findings.", "edits": [],
                "glossaryAdded": [], "mode": "single-shot"}

    seen = set()
    blocks = []
    for f in targets[:25]:
        i = f["para"]
        if i in seen:
            continue
        seen.add(i)
        line = st.source_window(i)
        src = "\n".join(ln for ln in st.raw_lines[max(0, line - 8):line + 8] if ln.strip())
        blocks.append(f"### para {i} — {f['type']}: {f['detail']}\nTRANSLATION:\n{st.paras[i]}\nSOURCE NEAR IT:\n{src}")

    tgt = series.get("targetLanguage", "English")
    prompt = (
        f"Fix the flagged paragraphs of this {tgt} light-novel translation. For each, decide from the source "
        f"whether the flag is real. Return ONLY JSON: {{\"edits\": [{{\"para\": <int>, \"new_text\": \"...\", "
        f"\"reason\": \"...\"}}]}}. Include only paragraphs you change; new_text is the full corrected paragraph "
        f"in {tgt}. Do not restyle correct text.\n\n" + "\n\n".join(blocks)
    )
    text = complete_text([{"role": "user", "content": prompt}]) or ""
    m = re.search(r"\{.*\}", text, re.S)
    edits = []
    try:
        edits = (json.loads(m.group(0)) if m else {}).get("edits") or []
    except Exception as e:
        log(f"[Agent] Single-shot repair returned unparseable JSON: {e}")

    # Apply bottom-up so earlier indices stay valid when a paragraph is split.
    for e in sorted(edits, key=lambda x: -int(x.get("para", -1))):
        result = toolkit.call("replace_paragraph", {
            "index": e.get("para"), "new_text": e.get("new_text", ""), "reason": e.get("reason", "single-shot"),
        })
        if result.startswith("ERROR"):
            log(f"[Agent] single-shot edit para {e.get('para')} refused: {result[:160]}")
    return {"steps": 1, "finished": True, "summary": f"Single-shot repair: {len(toolkit.edit_log)} edit(s).",
            "edits": list(toolkit.edit_log), "glossaryAdded": [], "mode": "single-shot"}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AgentRun:
    """Drives the whole loop on top of a Translator (reuses its pipeline and event channel)."""

    def __init__(self, translator, series_id: str, brief: str = "", review: str = REVIEW_FULL,
                 volume_pass: bool = True, rereview: bool = False, safe_fixes: bool = True):
        self.t = translator
        self.series_id = series_id
        self.brief = brief or ""
        self.review = review if review in (REVIEW_FINDINGS, REVIEW_FULL) else REVIEW_FULL
        self.volume_pass = volume_pass
        self.rereview = rereview
        self.safe_fixes = safe_fixes
        self.tools_supported = getattr(translator.client, "supports_tools", True)
        self.failures: List[str] = []
        self.total_edits = 0

    # -- plumbing --------------------------------------------------------------

    def _cancelled(self) -> bool:
        return self.t._cancelled or not self.t._batch_active

    def _log(self, msg: str):
        self.t._log(msg)

    def _emit(self, **data):
        payload = {"seriesId": self.series_id, "agent": True, **data}
        self.t._emit_js("onBatchStatus", self.t._with_meta(payload))

    def _complete_text(self, messages: List[Dict[str, str]]) -> str:
        response = self.t.client.complete(messages, stream=False, max_tokens=AGENT_MAX_TOKENS)
        return self.t._extract_response_text(response)

    # -- steps -----------------------------------------------------------------

    def _ensure_translated(self, chapter_id: str, chapter: Dict[str, Any]) -> bool:
        if chapter.get("status") == "done" and (chapter.get("translatedContent") or "").strip():
            return True
        for attempt in range(1, TRANSLATE_ATTEMPTS + 1):
            if self._cancelled():
                return False
            self.t._translate(self.series_id, chapter_id, None, archive_previous=True)
            ch = get_chapter(self.series_id, chapter_id) or {}
            if ch.get("status") == "done":
                self.t._auto_apply_glossary(self.series_id, chapter_id)
                return True
            if self._cancelled():
                return False
            wait = 15 * attempt
            self._log(f"[Agent] Translation attempt {attempt}/{TRANSLATE_ATTEMPTS} failed — retrying in {wait}s")
            for _ in range(wait):
                if self._cancelled():
                    return False
                time.sleep(1)
        return False

    def _review_chapter(self, chapter_ids: List[str], position: int, chapter: Dict[str, Any]) -> Dict[str, Any]:
        series = get_series(self.series_id) or {}
        raw = chapter.get("rawContent", "") or ""
        before = check_chapter(raw, chapter.get("translatedContent", ""), series.get("glossary") or [],
                               series.get("targetLanguage", "English"))
        stats_before = before["stats"]
        needs = stats_before["high"] + stats_before["medium"] > 0

        if not needs and self.review == REVIEW_FINDINGS:
            return {"skipped": True, "reason": "no high/medium findings", "findingsBefore": stats_before}

        toolkit = AgentToolkit(self.series_id, chapter_ids, mode="chapter",
                               focus_chapter_id=chapter["id"], log=self._log)
        pre_review_text = chapter.get("translatedContent", "")
        max_steps = CHAPTER_MAX_STEPS if self.review == REVIEW_FULL else FINDINGS_MAX_STEPS
        result: Optional[Dict[str, Any]] = None
        if self.tools_supported:
            try:
                result = run_session(
                    self.t.client, toolkit,
                    _chapter_system_prompt(series, raw, self.brief),
                    _chapter_task(position, len(chapter_ids), chapter, self.review == REVIEW_FULL),
                    max_steps, self._cancelled, self._log,
                )
            except ToolsUnsupported as e:
                self._log(f"[Agent] Model does not support tool calling ({str(e)[:120]}) — "
                          "switching to single-shot repair for this run")
                self.tools_supported = False
        if result is None:
            result = _single_shot_repair(self._complete_text, toolkit, series, self._log)

        after_ch = get_chapter(self.series_id, chapter["id"]) or {}
        series = get_series(self.series_id) or {}
        after = check_chapter(raw, after_ch.get("translatedContent", ""), series.get("glossary") or [],
                              series.get("targetLanguage", "English"))
        # The review must not leave the chapter worse than it found it.
        if after["stats"]["high"] > stats_before["high"] and toolkit.edit_log:
            from .storage.chapters import archive_current_translation, update_chapter_translation
            archive_current_translation(self.series_id, chapter["id"])
            update_chapter_translation(self.series_id, chapter["id"], pre_review_text)
            self._log(f"[Agent] Review raised high findings ({stats_before['high']} → {after['stats']['high']}) "
                      "— rolled back to the pre-review text (agent version kept in history)")
            result["rolledBack"] = True
            after = check_chapter(raw, pre_review_text, series.get("glossary") or [],
                                  series.get("targetLanguage", "English"))

        result["findingsBefore"] = stats_before
        result["findingsAfter"] = after["stats"]
        return result

    def _volume_session(self, chapter_ids: List[str]) -> Optional[Dict[str, Any]]:
        if not self.tools_supported or len(chapter_ids) < 2:
            return None
        series = get_series(self.series_id) or {}
        toolkit = AgentToolkit(self.series_id, chapter_ids, mode="volume", log=self._log)
        try:
            return run_session(
                self.t.client, toolkit,
                _volume_system_prompt(series, self.brief),
                f"The volume has {len(chapter_ids)} chapters. Make names and terms consistent across them.",
                VOLUME_MAX_STEPS, self._cancelled, self._log,
            )
        except ToolsUnsupported:
            return None

    # -- main loop ---------------------------------------------------------------

    def run(self):
        chapters = get_chapters(self.series_id)
        chapter_ids = [c["id"] for c in chapters]
        total = len(chapter_ids)
        completed = 0
        self._log(f"[Agent] Run started: {total} chapter(s) | review={self.review} | "
                  f"volume pass={'on' if self.volume_pass else 'off'}"
                  + (f" | brief: {self.brief.strip()[:120]}" if self.brief.strip() else ""))

        for position, chapter_id in enumerate(chapter_ids, 1):
            if self._cancelled():
                self._emit(status="cancelled", completed=completed, total=total)
                return
            chapter = get_chapter(self.series_id, chapter_id)
            if not chapter:
                completed += 1
                continue
            meta = dict(current=position, completed=completed, total=total, chapterId=chapter_id,
                        chapterNumber=chapter.get("chapterNumber", "?"), chapterTitle=chapter.get("title", ""))

            if chapter.get("status") != "done":
                self._emit(status="translating", phase="translate", **meta)
            if not self._ensure_translated(chapter_id, chapter):
                if self._cancelled():
                    self._emit(status="cancelled", completed=completed, total=total)
                    return
                self.failures.append(str(chapter.get("chapterNumber", "?")))
                self._log(f"[Agent] Chapter #{chapter.get('chapterNumber')} could not be translated — moving on")
                completed += 1
                continue

            chapter = get_chapter(self.series_id, chapter_id) or chapter
            if chapter.get("agentReview") and not self.rereview:
                completed += 1
                continue

            if self.safe_fixes:
                try:
                    from .qa_fix import DEFAULT_CATEGORIES
                    from .qa_scan import apply_safe_fixes_to_chapter
                    n = apply_safe_fixes_to_chapter(self.series_id, chapter_id, list(DEFAULT_CATEGORIES))
                    if n:
                        self._log(f"[Agent] Safe fixes: {n} paragraph change(s) without AI")
                        chapter = get_chapter(self.series_id, chapter_id) or chapter
                except Exception as e:
                    self._log(f"[Agent] Safe fixes failed (continuing): {e}")

            self._emit(status="translating", phase="review", **meta)
            self._log(f"[Agent] Reviewing chapter #{chapter.get('chapterNumber')} ({position}/{total})")
            try:
                result = self._review_chapter(chapter_ids, position, chapter)
            except Exception as e:
                self._log(f"[Agent] Review failed for #{chapter.get('chapterNumber')}: {e}")
                result = None
            if self._cancelled():
                self._emit(status="cancelled", completed=completed, total=total)
                return
            if result is not None:
                n = len(result.get("edits") or [])
                self.total_edits += n
                fb = result.get("findingsBefore", {})
                fa = result.get("findingsAfter", fb)
                self._log(f"[Agent] #{chapter.get('chapterNumber')}: {n} edit(s)"
                          + (" ROLLED BACK" if result.get("rolledBack") else "") + " | "
                          f"high {fb.get('high', 0)}→{fa.get('high', 0)}, "
                          f"medium {fb.get('medium', 0)}→{fa.get('medium', 0)}"
                          + (f" | {result['summary'][:200]}" if result.get("summary") else ""))
                update_chapter_fields(self.series_id, chapter_id, agentReview={
                    "reviewedAt": datetime.utcnow().isoformat() + "Z",
                    "model": getattr(self.t.client, "model", ""),
                    **{k: v for k, v in result.items() if k != "edits"},
                    "edits": (result.get("edits") or [])[:100],
                })
            completed += 1

        volume = None
        if self.volume_pass and not self._cancelled():
            self._emit(status="translating", phase="volume", current=total, completed=completed, total=total)
            self._log("[Agent] Volume consistency pass")
            try:
                volume = self._volume_session(chapter_ids)
            except Exception as e:
                self._log(f"[Agent] Volume pass failed: {e}")
            if volume:
                self.total_edits += len(volume.get("edits") or [])
                self._log(f"[Agent] Volume pass: {len(volume.get('edits') or [])} edit(s)"
                          + (f" | {volume['summary'][:300]}" if volume.get("summary") else ""))

        if self._cancelled():
            self._emit(status="cancelled", completed=completed, total=total)
            return
        self._log(f"[Agent] Run finished: {completed}/{total} chapter(s), {self.total_edits} edit(s)"
                  + (f", failed: {', '.join(self.failures)}" if self.failures else ""))
        self._emit(status="done", completed=completed, total=total, edits=self.total_edits, failed=self.failures)
