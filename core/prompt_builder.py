"""
Prompt Builder Module
Builds system and user prompts for translation with template variable support
"""

from typing import Dict, Any, List


# Default system prompt templates per target language
# Supports variables: {source_language}, {target_language}, {title}
DEFAULT_SYSTEM_PROMPTS = {
    "Indonesian": """Kamu adalah penerjemah profesional light novel dan web novel dari {source_language} ke {target_language}.

# Panduan Penerjemahan:
- Pertahankan nada dan gaya asli teks (humor, serius, dramatis, romantis, dll.)
- Jaga struktur paragraf — satu paragraf asli = satu paragraf terjemahan
- Gunakan bahasa {target_language} yang natural, mengalir, dan enak dibaca
- Pertahankan honorifik dari bahasa sumber secara kontekstual (contoh: -san, -nim, 前辈, dll.)
- Jaga nuansa puitis, idiom, dan permainan kata bila memungkinkan

# Format Output (Markdown):
- Gunakan *teks miring* untuk monolog batin karakter dan onomatopea/SFX (contoh: *Kenapa dia ada di sini...*, *Brak!*)
- Gunakan *** (tiga bintang di baris tersendiri) untuk pemisah adegan atau pergantian POV
- JANGAN sertakan catatan penerjemah, penjelasan, atau komentar apapun
- Berikan HANYA teks terjemahan, langsung tanpa pembuka
- Saat terjemahan selesai, akhiri dengan: [SELESAI]""",

    "English": """You are a professional light novel and web novel translator from {source_language} to {target_language}.

# Translation Guidelines:
- Maintain the original tone and style (humorous, serious, dramatic, romantic, etc.)
- Preserve paragraph structure — one original paragraph = one translated paragraph
- Use natural, fluent, and readable {target_language} language
- Adapt honorifics from the source language contextually (e.g. -san, -nim, 前辈, etc.)
- Preserve poetic nuances, idioms, and wordplay where possible

# Output Format (Markdown):
- Use *italic text* for character inner monologue and onomatopoeia/SFX (e.g. *Why is he here...*, *Crash!*)
- Use *** (three asterisks on their own line) for scene breaks or POV shifts
- Do NOT include translator notes, explanations, or any meta-commentary
- Provide ONLY the translated text, starting immediately
- When complete, end with: [DONE]""",
}

# Template for custom languages
GENERIC_TEMPLATE = """You are a professional light novel and web novel translator from {source_language} to {target_language}.

# Translation Guidelines:
- Maintain the original tone and style (humorous, serious, dramatic, romantic, etc.)
- Preserve paragraph structure — one original paragraph = one translated paragraph
- Use natural, fluent, and readable {target_language} language
- Adapt honorifics from the source language contextually
- Preserve poetic nuances, idioms, and wordplay where possible

# Output Format (Markdown):
- Use *italic text* for character inner monologue and onomatopoeia/SFX
- Use *** (three asterisks on their own line) for scene breaks or POV shifts
- Do NOT include translator notes, explanations, or any meta-commentary
- Provide ONLY the translated text, starting immediately
- When complete, end with: [END]"""


def get_default_system_prompt(target_language: str) -> str:
    """Get default system prompt template for a target language"""
    if target_language in DEFAULT_SYSTEM_PROMPTS:
        return DEFAULT_SYSTEM_PROMPTS[target_language]
    # Generate from generic template
    return GENERIC_TEMPLATE


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
    memory_context: str = ""
) -> str:
    """
    Build system prompt for translation with full layered context.

    Args:
        series: Series data with glossary, instructions, targetLanguage, systemPrompt
        rolling_context: Layer 2 - summaries of recent chapters
        memory_context: Layer 3 - compacted long-term memory

    Returns:
        str: System prompt
    """
    custom_prompt = series.get("systemPrompt", "").strip()

    # Use custom prompt if provided, otherwise use default for target language
    target_lang = series.get("targetLanguage", "Indonesian")
    if custom_prompt:
        base_prompt = custom_prompt
    else:
        base_prompt = get_default_system_prompt(target_lang)

    # Resolve template variables
    system_prompt = resolve_template_vars(base_prompt, series) + "\n\n"

    # Add custom instructions (per-series, user-defined)
    instructions = series.get("instructions", "").strip()
    if instructions:
        system_prompt += f"# Custom Instructions:\n{instructions}\n\n"

    # Add glossary if provided
    glossary = series.get("glossary", [])
    if glossary:
        system_prompt += "# Glossary (use these translations):\n"
        system_prompt += build_glossary_table(glossary)
        system_prompt += "\n"

    # Layer 2: Rolling context (recent chapter summaries)
    if rolling_context:
        system_prompt += f"\n{rolling_context}"

    # Layer 3: Memory context (compacted long-term memory)
    if memory_context:
        system_prompt += f"\n{memory_context}"

    return system_prompt


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
    system_prompt = """You are a terminology extraction assistant for light novels and web novels.

# Task:
Analyze the provided original and translated text to extract:
1. Character names (and their aliases/honorifics)
2. Important locations/places
3. Special terms (abilities, organizations, unique concepts)
4. Technical terms (if any)

# Output Format:
Return ONLY a JSON array in this exact format:
[
  {
    "sourceTerm": "原始术语",
    "translatedTerm": "Translated Term",
    "notes": "brief context or notes (e.g., main character, location, ability name)"
  }
]

# Guidelines:
- Extract ONLY significant terms (names, locations, special concepts)
- Ignore common words and phrases
- Provide brief, helpful context in notes
- Maximum 20 terms total (prioritize most important)
- Return VALID JSON only, no markdown formatting
"""

    user_prompt = f"""Original text (first ~500 chars):
{raw_content[:500]}

Translated text (first ~500 chars):
{translated_content[:500]}

Extract glossary terms from these texts. Return JSON array only.
"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]