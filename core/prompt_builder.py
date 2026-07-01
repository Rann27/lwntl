"""
Prompt Builder Module
Builds system and user prompts for translation with template variable support
"""

from typing import Dict, Any, List

def get_profile_system_prompt_template() -> str:
    """Get the active profile's system prompt template (empty string if not set)."""
    from core.storage.templates import get_profile_templates
    return get_profile_templates().get("systemPromptTemplate", "")


def get_profile_instructions_template() -> str:
    """Get the active profile's instructions template (empty string if not set)."""
    from core.storage.templates import get_profile_templates
    return get_profile_templates().get("instructionsTemplate", "")


def resolve_template_vars(template: str, series: Dict[str, Any]) -> str:
    """
    Resolve template variables in a prompt string.
    
    Supported variables:
    - {source_language} → series sourceLanguage
    - {target_language} → series targetLanguage
    - {title} → series title
    """
    result = template
    result = result.replace("{source_language}", series.get("sourceLanguage", "Japanese"))
    result = result.replace("{target_language}", series.get("targetLanguage", "Indonesian"))
    result = result.replace("{title}", series.get("title", ""))
    return result


def build_system_prompt(
    series: Dict[str, Any],
    rolling_context: str = "",
    memory_context: str = "",
    raw_content: str = "",
    pre_filter: bool = True,
) -> str:
    """
    Build system prompt for translation with full layered context.

    Args:
        series: Series data with glossary, instructions, targetLanguage, systemPrompt
        rolling_context: Layer 2 - summaries of recent chapters
        memory_context: Layer 3 - compacted long-term memory
        raw_content: Raw chapter content used to pre-filter glossary to relevant terms only

    Returns:
        str: System prompt
    """
    custom_prompt = series.get("systemPrompt", "").strip()

    # Resolution order: per-series custom → profile template → nothing
    base_prompt = custom_prompt or get_profile_system_prompt_template()

    if not base_prompt:
        system_prompt = ""
    else:
        system_prompt = resolve_template_vars(base_prompt, series) + "\n\n"

    # Instructions: per-series → profile template → nothing
    instructions = series.get("instructions", "").strip() or get_profile_instructions_template().strip()
    if instructions:
        system_prompt += f"# Custom Instructions:\n{resolve_template_vars(instructions, series)}\n\n"

    # Add glossary — pre-filtered to terms that actually appear in this chapter.
    # Injecting the full glossary when it has hundreds of entries overwhelms the
    # model's attention; keeping only relevant terms improves adherence significantly.
    glossary = series.get("glossary", [])
    if glossary:
        if pre_filter and raw_content:
            filtered = filter_glossary_by_content(glossary, raw_content)
            total = len(glossary)
            relevant = len(filtered)
            if relevant < total:
                print(f"[Glossary] Pre-filter: {relevant}/{total} term(s) relevant to this chapter")
        else:
            filtered = glossary

        if filtered:
            system_prompt += "# Glossary (use these translations EXACTLY — non-negotiable):\n"
            system_prompt += build_glossary_table(filtered)
            system_prompt += "\n"

    # Layer 2: Rolling context (recent chapter summaries)
    if rolling_context:
        system_prompt += f"\n{rolling_context}"

    # Layer 3: Memory context (compacted long-term memory)
    if memory_context:
        system_prompt += f"\n{memory_context}"

    return system_prompt


def _is_subsequence(term: str, text: str) -> bool:
    """Return True if every character in term appears in text in order (gaps allowed).
    Handles interleaved furigana: 船ふな坂さか叶馬 still contains 船坂叶馬 as a subsequence.
    """
    it = iter(text)
    return all(c in it for c in term)


def filter_glossary_by_content(glossary: List[Dict[str, Any]], raw_content: str) -> List[Dict[str, Any]]:
    """
    Return only glossary entries whose sourceTerm appears in raw_content.

    Two-level matching to handle furigana-contaminated Japanese text:
    1. Exact substring  — 船坂叶馬 in "船坂叶馬が歩いた"
    2. Subsequence      — 船坂叶馬 in "船ふな坂さか叶馬" (furigana interleaved between kanji)

    False positives (term included though absent) are acceptable;
    false negatives (term silently dropped) break translation.
    Single-char terms are kept as exact-only to avoid subsequence noise.
    """
    if not glossary or not raw_content:
        return glossary
    result = []
    for e in glossary:
        term = (e.get("sourceTerm") or "").strip()
        if not term:
            continue
        if term in raw_content:
            result.append(e)
        elif len(term) >= 2 and _is_subsequence(term, raw_content):
            result.append(e)
    return result


def build_glossary_table(glossary: List[Dict[str, Any]]) -> str:
    """
    Build glossary table for prompt
    """
    if not glossary:
        return ""

    table = "| Source Term | Translated Term | Notes |\n"
    table += "|------------|---------------|-------|\n"

    for entry in glossary:
        source = entry.get("sourceTerm", "")
        translated = entry.get("translatedTerm", "")
        notes = entry.get("notes", "")
        table += f"| {source} | {translated} | {notes} |\n"

    return table


def build_user_prompt(raw_content: str, chapter: Dict[str, Any], target_language: str = "Indonesian") -> str:
    """
    Build user prompt for translation

    Args:
        raw_content: Raw text content to translate
        chapter: Chapter data
        target_language: Target language to translate to
    """
    title = chapter.get("title", "Chapter")
    chapter_number = chapter.get("chapterNumber", 1)

    user_prompt = f"""Translate the following content from {title} (Chapter {chapter_number}):

--- START CONTENT ---
{raw_content}
--- END CONTENT ---

Translate to {target_language}. Start your response immediately with the translated text.
"""

    return user_prompt


def build_extraction_prompt(raw_content: str, translated_content: str) -> List[Dict[str, str]]:
    """
    Build messages for glossary extraction
    """
    system_prompt = """You are a specialist in extracting proper nouns and key terminology from Japanese light novel translations.

# Your job:
Extract ALL proper nouns and key terms from the source (Japanese) and translation pair. Be thorough — do not miss any name or term a human translator would want in a glossary.

# What to extract (extract EVERY instance):
- Character names — main, supporting, even minor characters mentioned once
- Character nicknames, titles, epithets (e.g. 勇者, 魔王)
- Location names — schools, cities, buildings, dungeons, countries, realms
- Organization names — guilds, academies, clubs, factions
- Skill and ability names
- Unique items, weapons, artifacts
- World-specific terminology and concepts

# What NOT to extract:
- Common Japanese words with standard translations
- Generic honorifics (-san, -kun) unless used as a name substitute
- Common nouns (door, sword, magic) unless they are a unique named item

# Output format — return ONLY a valid JSON array, no markdown:
[
  {
    "sourceTerm": "Japanese term exactly as it appears in source",
    "translatedTerm": "Translation used in the translated text",
    "notes": "role or context (e.g. main character, school name, ability)"
  }
]

If a name has furigana in the source (e.g. 叶馬（とうま）), use the kanji form as sourceTerm.
Return VALID JSON only. No explanation, no markdown fences."""

    user_prompt = f"""Source text (Japanese):
{raw_content[:3000]}

---
Translated text:
{translated_content[:3000]}

Extract all proper nouns and key terms. Return JSON array only."""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]