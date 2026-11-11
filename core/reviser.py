"""
Revision Pass — second look at a finished draft.

The translator writes a chapter in one linear stream and never sees what it
produced. Some rules cannot be obeyed that way: you cannot tell that an
attribution is redundant, or that five paragraphs in a row open the same way,
until the text exists as an object you can read. Those rules stay aspirational in
a single pass.

This pass gives the model that second look. It receives the source and its own
draft, and is asked for prose quality only — never a re-translation.

Safety
------
Revision rewrites prose, so it can damage structure. Every result is checked
before it is accepted:
  - paragraphs may not be merged: the count may only stay equal or grow
    (growing is allowed so two speakers sharing a paragraph can be separated)
  - dialogue paragraphs may not disappear (one dialogue line = one paragraph)
  - scene markers must stay exactly as many as in the draft
  - length must stay within a sane band of the draft
  - every illustration placeholder must survive
A failed check keeps the draft. A revision that cannot be verified is never worth
the risk of silent corruption.

The trailing glossary table is split off first and re-appended untouched, the
same way AutoFix CJK handles it — its Source Term column is not prose and must
not be rewritten.
"""

from typing import Any, Callable, Dict, List, Optional

from .extractor import strip_glossary_table
from .placeholder import collect_placeholder_filenames, wrap_placeholders, unwrap_placeholders

# Accepted deviation in total length versus the draft. A revision should tighten
# or loosen wording, not rewrite the chapter.
_MIN_LENGTH_RATIO = 0.6
_MAX_LENGTH_RATIO = 1.6

def get_revision_prompt(series: Dict[str, Any]) -> str:
    """Profile template if the user set one, otherwise the built-in prompt for the target language."""
    from .task_prompts import build_task_prompt
    return build_task_prompt(
        "revision",
        series.get("sourceLanguage", "Japanese"),
        series.get("targetLanguage", "English"),
        series.get("title", ""),
    )


def _dialogue_count(paras: List[str]) -> int:
    return sum(1 for p in paras if p.lstrip().startswith(('"', '“', '「')))


def _scene_marker_count(paras: List[str]) -> int:
    from .chapter_check import is_scene_marker
    return sum(1 for p in paras if is_scene_marker(p))


def _paragraphs(text: str) -> List[str]:
    return [p for p in (text or "").split("\n\n") if p.strip()]


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


def _strip_fences(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        lines = t.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines)
    return t


def revise_translation(
    llm_client,
    raw_content: str,
    translation: str,
    series: Dict[str, Any],
    max_tokens: Optional[int] = None,
    log: Optional[Callable[[str], None]] = None,
) -> str:
    """
    Return a prose-revised translation, or the original when the result fails a check.

    The caller can treat the return value as a drop-in replacement — it is always
    a complete, structurally valid translation.
    """
    def _emit(msg: str):
        if callable(log):
            log(msg)

    if not translation or not translation.strip():
        return translation

    # Keep the glossary table out of the revision entirely.
    body = strip_glossary_table(translation)
    if body and translation.startswith(body) and len(body) < len(translation):
        table_tail = translation[len(body):]
    else:
        body, table_tail = translation, ""

    if not body.strip():
        return translation

    draft_paras = _paragraphs(body)
    draft_placeholders = set(collect_placeholder_filenames(body))

    system_prompt = get_revision_prompt(series)
    user_prompt = (
        f"--- SOURCE ({series.get('sourceLanguage', 'Japanese')}, reference only) ---\n"
        f"{raw_content}\n"
        "--- END SOURCE ---\n\n"
        "--- DRAFT TRANSLATION (revise this) ---\n"
        f"{wrap_placeholders(body)}\n"
        "--- END DRAFT ---\n\n"
        "Output the revised translation only."
    )

    _emit(f"[Revision] Revising {len(draft_paras)} paragraph(s)...")

    try:
        response = llm_client.complete(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=False,
            max_tokens=max_tokens or getattr(llm_client, "max_tokens", 16000),
        )
    except Exception as e:
        _emit(f"[Revision] Call failed, keeping draft: {e}")
        return translation

    revised = unwrap_placeholders(_strip_fences(_extract_text(response))).strip()
    if not revised:
        _emit("[Revision] Empty response, keeping draft")
        return translation

    # --- structural checks -------------------------------------------------
    revised_paras = _paragraphs(revised)
    if len(revised_paras) < len(draft_paras):
        _emit(
            f"[Revision] Paragraphs were merged ({len(draft_paras)} -> "
            f"{len(revised_paras)}), keeping draft"
        )
        return translation

    if _dialogue_count(revised_paras) < _dialogue_count(draft_paras):
        _emit(
            f"[Revision] Dialogue lines dropped or merged ({_dialogue_count(draft_paras)} -> "
            f"{_dialogue_count(revised_paras)}), keeping draft"
        )
        return translation

    if _scene_marker_count(revised_paras) != _scene_marker_count(draft_paras):
        _emit("[Revision] Scene marker count changed, keeping draft")
        return translation

    ratio = len(revised) / max(len(body), 1)
    if not (_MIN_LENGTH_RATIO <= ratio <= _MAX_LENGTH_RATIO):
        _emit(f"[Revision] Length ratio {ratio:.2f} out of band, keeping draft")
        return translation

    lost = draft_placeholders - set(collect_placeholder_filenames(revised))
    if lost:
        _emit(f"[Revision] Lost placeholder(s) {sorted(lost)}, keeping draft")
        return translation

    changed = len(set(p.strip() for p in revised_paras) - set(p.strip() for p in draft_paras))
    _emit(f"[Revision] Accepted — {changed} paragraph(s) reworked"
          + (f", {len(revised_paras) - len(draft_paras)} split" if len(revised_paras) > len(draft_paras) else ""))

    return revised + table_tail
