"""
QA Safe Fixes — mechanical repairs that need no model and no judgment.

Each category only rewrites what a rule fully determines. Anything that needs
the source or a reading of the scene (attribution, openers, pronoun register,
dead wordplay) is left to the reviewer or the repair agent.

Categories:
    typography      double spaces, space before , ; : ! ? and a single period, -- → —
    marks           「」 → double quotes, …… → …, ─/━ runs → —, LaTeX `` '' → quotes
    macron          ā ī ū ē ō → aa ii uu ee ou (Tōkyō/Ōsaka/Kyōto → standard spelling)   [JP and other sources]
    tone            Pinyin tone marks → plain Pinyin (Lín → Lin, Lǚ → Lu)               [CN source]
                    ŏ / ŭ → eo / eu (Revised Romanization)                            [KR source]
    bold            **text** → text (only italics are allowed)
    italic_spacing  "* text *" → "*text*"
    quotes          curly double quotes → straight, when straight is the chapter's style
    ejaan           non-standard Indonesian spelling → standard (nafas → napas)   [ID only]
    acronym         lowercase acronyms → uppercase (tv → TV)

Placeholder lines, scene-marker lines and the trailing glossary table are never touched.
"""

import re
from typing import Any, Dict, List, Tuple

from .chapter_check import (
    ACRONYM_RE, ANDA_LOWER, EJAAN_ID_RE, PINYIN_TONE, TONE_LOANWORDS, is_scene_marker, lang_code,
    source_code, split_paragraphs,
)
from .extractor import strip_glossary_table
from .placeholder import is_placeholder_line

SAFE_CATEGORIES = ("typography", "marks", "macron", "tone", "homoglyph", "bold", "italic_spacing", "quotes",
                   "ejaan", "acronym")
# Applied automatically by the agent run before review. Lexical categories
# (ejaan, acronym) and quote-style normalisation stay opt-in.
DEFAULT_CATEGORIES = ("typography", "marks", "macron", "tone", "homoglyph", "bold", "italic_spacing")
ID_ONLY = ("ejaan",)
# Romanization marks follow the source: ō is "ou" in Japanese, "o" in Pinyin.
TONE_SOURCES = ("cn", "kr")


def available_categories(target_language: str, source_language: str = "Japanese") -> List[str]:
    """Safe-fix categories that apply to this language pair."""
    lang, src = lang_code(target_language), source_code(source_language)
    out = []
    for c in SAFE_CATEGORIES:
        if c in ID_ONLY and lang != "id":
            continue
        if c == "macron" and src in TONE_SOURCES:
            continue
        if c == "tone" and src not in TONE_SOURCES:
            continue
        out.append(c)
    return out

_MACRON_PLACES = {
    "Tōkyō": "Tokyo", "Ōsaka": "Osaka", "Kyōto": "Kyoto", "Kyūshū": "Kyushu", "Hokkaidō": "Hokkaido",
    "Honshū": "Honshu", "Shikoku": "Shikoku", "Kōbe": "Kobe", "Tōhoku": "Tohoku", "Kantō": "Kanto",
    "Kansai": "Kansai", "Ryūkyū": "Ryukyu",
}
_MACRON_MAP = str.maketrans({"ā": "aa", "ī": "ii", "ū": "uu", "ē": "ee", "ō": "ou",
                             "Ā": "Aa", "Ī": "Ii", "Ū": "Uu", "Ē": "Ee", "Ō": "Ou"})


def _fix_typography(p: str) -> str:
    p = re.sub(r'(?<=\S) {2,}(?=\S)', ' ', p)
    p = re.sub(r'(?<=[^\s]) +([,;:!?])', r'\1', p)
    p = re.sub(r'(?<=[^\s.]) +\.(?!\.)', '.', p)
    p = re.sub(r'(?<!-)--(?!-)', '—', p)
    return p


_FULLWIDTH = [(r'[，、]\s*', ', '), (r'。\s*', '. '), (r'！', '!'), (r'？', '?'), (r'：\s*', ': '),
              (r'；\s*', '; '), (r'（', '('), (r'）', ')')]


def _fix_marks(p: str, curly: bool) -> str:
    open_q, close_q = ('“', '”') if curly else ('"', '"')
    p = p.replace('「', open_q).replace('」', close_q)
    p = re.sub(r'……+|‥', '…', p)
    p = re.sub(r'[─━]+|——', '—', p)
    for rx, repl in _FULLWIDTH:
        p = re.sub(rx, repl, p)
    p = re.sub(r' +([”"\)])', r'\1', p).rstrip()
    p = p.replace('``', open_q).replace("''", close_q)
    return p


def _fix_macron(p: str) -> str:
    for k, v in _MACRON_PLACES.items():
        p = p.replace(k, v)
    return p.translate(_MACRON_MAP)


# Cyrillic/Greek letters that look Latin. Only replaced when touching a Latin
# letter, so genuine Cyrillic or Greek words are left alone.
_HOMOGLYPHS = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s",
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T",
    "Х": "X", "У": "Y", "І": "I", "ο": "o", "α": "a", "ι": "i", "ν": "v", "Ο": "O", "Α": "A", "Β": "B",
    "Ε": "E", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ρ": "P", "Τ": "T", "Χ": "X", "Υ": "Y", "Ζ": "Z",
}
_HOMOGLYPH_WORD = re.compile(r"[A-Za-z" + "".join(_HOMOGLYPHS) + r"]+")


def _fix_homoglyph(p: str) -> str:
    def word(m):
        w = m.group(0)
        if not re.search(r"[A-Za-z]", w):
            return w
        return "".join(_HOMOGLYPHS.get(ch, ch) for ch in w)
    return _HOMOGLYPH_WORD.sub(word, p)


_TONE_MAP = str.maketrans("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙÜ",
                          "aaaaeeeeiiiioooouuuuuuuuuAAAAEEEEIIIIOOOOUUUUU")


def _fix_tone(p: str) -> str:
    """Plain Pinyin / Revised Romanization; English loanwords keep their accent."""
    p = p.replace("ŏ", "eo").replace("ŭ", "eu").replace("Ŏ", "Eo").replace("Ŭ", "Eu")
    return PINYIN_TONE.sub(lambda m: m.group(0) if m.group(0).lower() in TONE_LOANWORDS
                           else m.group(0).translate(_TONE_MAP), p)


def _fix_bold(p: str) -> str:
    return re.sub(r'\*\*(.+?)\*\*', r'\1', p).replace("**", "")


def _fix_italic_spacing(p: str) -> str:
    return re.sub(r'\*\s*([^*\n]+?)\s*\*', lambda m: f"*{m.group(1)}*", p)


def _fix_quotes(p: str) -> str:
    return p.replace('“', '"').replace('”', '"')


def _match_case(src: str, repl: str) -> str:
    if src.isupper():
        return repl.upper()
    if src[:1].isupper():
        return repl[:1].upper() + repl[1:]
    return repl


def _fix_ejaan(p: str) -> str:
    for good, rx in EJAAN_ID_RE:
        p = rx.sub(lambda m, g=good: _match_case(m.group(1), g) + m.group(2), p)
    return ANDA_LOWER.sub("Anda", p)


def _fix_acronym(p: str, lang: str) -> str:
    return ACRONYM_RE[lang].sub(lambda m: m.group(1).upper(), p)


def _chapter_quote_style(paras: List[str]) -> Tuple[int, int]:
    straight = sum(1 for p in paras if '"' in p)
    curly = sum(1 for p in paras if '“' in p or '”' in p)
    return straight, curly


def apply_safe_fixes(
    translated_content: str,
    categories: List[str],
    target_language: str = "English",
    source_language: str = "Japanese",
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Apply the chosen categories to one chapter.

    Returns (new_content, changes). `changes` lists {category, para, before, after}
    per paragraph and category; an empty list means the text is unchanged.
    Categories that do not apply to the language pair are skipped.
    """
    lang = lang_code(target_language)
    allowed = set(available_categories(target_language, source_language))
    cats = [c for c in categories if c in allowed]
    full = translated_content or ""
    body = strip_glossary_table(full)
    if body and full.startswith(body) and len(body) < len(full):
        tail = full[len(body):]
    else:
        body, tail = full, ""

    paras = split_paragraphs(body)
    straight, curly = _chapter_quote_style(paras)
    use_curly = curly > straight
    fixers = {
        "typography": _fix_typography,
        "marks": lambda p: _fix_marks(p, use_curly),
        "macron": _fix_macron,
        "tone": _fix_tone,
        "homoglyph": _fix_homoglyph,
        "bold": _fix_bold,
        "italic_spacing": _fix_italic_spacing,
        "quotes": _fix_quotes if straight >= curly else (lambda p: p),
        "ejaan": _fix_ejaan,
        "acronym": lambda p: _fix_acronym(p, lang),
    }

    changes: List[Dict[str, Any]] = []
    out: List[str] = []
    for i, p in enumerate(paras):
        if is_placeholder_line(p) or is_scene_marker(p):
            out.append(p)
            continue
        cur = p
        for c in cats:
            nxt = fixers[c](cur)
            if nxt != cur:
                changes.append({"category": c, "para": i, "before": cur[:200], "after": nxt[:200]})
                cur = nxt
        out.append(cur)

    if not changes:
        return full, []
    new_body = "\n\n".join(out)
    new_full = new_body.rstrip() + "\n\n" + tail.lstrip("\n") if tail else new_body
    return new_full, changes
