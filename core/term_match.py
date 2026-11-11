"""
Term Match — one answer to "does this glossary term occur in this text?"

The glossary pre-filter, duplicate detection, the auto-apply one-off check, the
audit and the QA glossary check all depend on that answer. When they disagree,
the worst case follows: a term that is in the chapter is filtered out, the model
never sees its locked rendering, invents another one, and its glossary table
proposes the invention as a new entry under a slightly different spelling.

So matching here is deliberately tolerant. Including an absent term costs a few
prompt tokens; dropping a present one forks the translation.

Both the term and the text are normalised before comparing:
    NFKC               ｱﾘｽ → アリス, ＡＢＣ → abc, ＝ → =
    variant kanji      髙 → 高, 﨑 → 崎, 德 → 徳 …
    name separators    ・ = ゠ · next to CJK are removed:
                       アリス・ミラー ≈ アリス＝ミラー ≈ アリスミラー
    whitespace         removed next to CJK (spaced furigana 【 杖 じよう 剣 けん 】 closes up)
    term brackets      【】『』［］《》〈〉〔〕〖〗 removed — 【爆破】のルーン is 爆破のルーン
    case               lowered

An entry is looked for under every one of its forms: the source term, its aliases
(other source spellings of the same thing), both halves of a term stored with its
reading in brackets (空間収納（アイテムボックス） → 空間収納, アイテムボックス) and each
of those without a trailing honorific (叶馬くん, 魔王様 → 叶馬, 魔王). Up to eight kana or ruby marks may follow
any kanji, so inline furigana (hiragana or katakana) never hides a term. A verb or
adjective entry also matches its inflections through its stem (震える → 震えている).

A full-name entry (rendered as two or more capitalised words) is also found by its
parts, because characters are mostly called by one name:
    explicit separators   アリス・ミラー → アリス, ミラー
    otherwise             every prefix/suffix of 2+ characters (小野寺誠 → 小野寺, 寺誠 …)
                          and a one-kanji given name standing alone (誠が笑った → 誠),
                          for person names of 3+ characters only

What this cannot see: a term written in kana where the glossary has kanji
(魔王 vs まおう), or with different okurigana (引き籠もり vs 引きこもり). Those need
an alias on the entry; auto-apply records one when the chapter table renders the
other spelling exactly like a name or proper term in the glossary. Common words
that share a rendering (嫉妬 / ジェラシー = jealousy) are synonyms, not spellings,
and stay separate entries.
"""

import re
import unicodedata
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional, Tuple

_KANJI = '㐀-䶿一-鿿々'
_CJK = '぀-ゟ゠-ヿ' + _KANJI          # kana (incl. ・ and ー) + kanji
_KANJI_RE = re.compile(f'[{_KANJI}]')
_CJK_RE = re.compile(f'[{_CJK}]')
_ALL_CJK_RE = re.compile(f'^[{_CJK}]+$')

# After NFKC: ＝ → =, ･ → ・. The middle dot family and = join name parts.
_SEPARATORS = '・=゠·•'
_SEP_CLASS = '[' + re.escape(_SEPARATORS) + ']'
_JOINERS_NEAR_CJK = re.compile(
    f'(?<=[{_CJK}])[{re.escape(_SEPARATORS)}\\s]+|[{re.escape(_SEPARATORS)}\\s]+(?=[{_CJK}])'
)
_STRAY_DOTS = re.compile('[・゠]')
_BRACKETS = re.compile(r'[【】『』\[\]《》〈〉〔〕〖〗]')
_SPACES = re.compile(r'\s+')
_NAME_SPLIT = re.compile(f'(?:{_SEP_CLASS}|\\s)+')

# Kana or ruby marks that may sit after a kanji: 杖じよう剣, 杖(じょう)剣, |杖《じょう》剣,
# 忍ニン者 (brackets are already gone after normalize)
_READING_GAP = '[ぁ-ゖァ-ヺー()|]{0,8}'

# Typographic variants of the same kanji (mostly in names). Only forms that are the
# same character in practice — 竜/龍 and similar pairs some stories keep distinct
# are left alone.
_VARIANT_KANJI = str.maketrans({
    '髙': '高', '﨑': '崎', '嵜': '崎', '德': '徳', '邊': '辺', '邉': '辺', '齋': '斎',
    '濵': '浜', '濱': '浜', '槗': '橋', '彌': '弥', '冨': '富', '𠮷': '吉', '舘': '館',
    '嶋': '島', '嶌': '島', '澤': '沢', '櫻': '桜', '眞': '真', '惠': '恵', '國': '国',
})

# Trailing honorifics stripped to get an entry's base form. Longest first.
_HONORIFIC_SUFFIXES = sorted(
    ('さま', '様', 'さん', 'くん', '君', 'ちゃん', 'ちゃま', '殿', 'どの', '先輩', 'せんぱい',
     '先生', 'せんせい', '氏', '嬢', 'たん'),
    key=len, reverse=True,
)


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    t = unicodedata.normalize('NFKC', text or '').translate(_VARIANT_KANJI)
    t = _BRACKETS.sub('', t)
    t = _JOINERS_NEAR_CJK.sub('', t)
    t = _STRAY_DOTS.sub('', t)
    t = _SPACES.sub(' ', t)
    return t.strip().lower()


@lru_cache(maxsize=16384)
def normalize(text: str) -> str:
    """Comparable form of a term (see module docstring)."""
    return _normalize(text)


@lru_cache(maxsize=64)
def normalize_text(text: str) -> str:
    """normalize() for whole chapters — a separate cache, so the many short terms
    never push the long texts out and force them to be normalised again."""
    return _normalize(text)


def strip_honorific(form: str) -> str:
    """叶馬くん → 叶馬. The base must keep at least two characters (暴君 stays 暴君)."""
    for suffix in _HONORIFIC_SUFFIXES:
        if form.endswith(suffix) and len(form) - len(suffix) >= 2:
            return form[: -len(suffix)]
    return form


_ALNUM = re.compile(r'[^\W_]', re.UNICODE)


def rendering_key(translated: str) -> str:
    """
    Comparable form of a rendering: NFKC, lowercase, whitespace collapsed — and
    nothing else. Honorifics and numbers stay: Futaba-nee is not Futaba, Area 3 is
    not Area 1-5. Placeholders without two letters or digits ('—', '-') give ''
    so they never match each other.
    """
    key = _SPACES.sub(' ', unicodedata.normalize('NFKC', translated or '')).strip().lower()
    return key if len(_ALNUM.findall(key)) >= 2 else ''


# ---------------------------------------------------------------------------
# Forms and patterns of one entry
# ---------------------------------------------------------------------------

def _sources(entry: Dict[str, Any]) -> List[str]:
    out = [entry.get('sourceTerm') or '']
    out.extend(a for a in (entry.get('aliases') or []) if isinstance(a, str))
    return [s for s in out if s.strip()]


# A term with its reading or gloss in brackets: 魂(こん), 空間収納(アイテムボックス).
# The bracketed half counts as a spelling only with katakana or kanji in it — a
# hiragana reading alone (こん) would match all over the text.
_BRACKETED_READING = re.compile(r'^(.+?)\((.+?)\)$')
_SPELLING_RE = re.compile(f'[ァ-ヺ{_KANJI}]')


def entry_forms(entry: Dict[str, Any], honorifics: bool = True) -> List[str]:
    """
    Normalised source term and aliases (and both halves of a bracketed reading),
    each also without a trailing honorific.
    """
    forms: List[str] = []
    for src in _sources(entry):
        n = normalize(src)
        variants = [n]
        m = _BRACKETED_READING.match(n)
        if m:
            variants.append(m.group(1).strip())
            if _SPELLING_RE.search(m.group(2)):
                variants.append(m.group(2).strip())
        for v in variants:
            for f in ((v, strip_honorific(v)) if honorifics else (v,)):
                if f and f not in forms:
                    forms.append(f)
    return forms


def is_full_name(entry: Dict[str, Any]) -> bool:
    from .glossary_guard import looks_like_full_name
    return looks_like_full_name(entry.get('translatedTerm') or '')


def name_parts(entry: Dict[str, Any]) -> List[Tuple[str, bool]]:
    """
    (part, standalone) pairs a full name may be referred to by. `standalone` parts
    are single kanji that only count when no other kanji touches them.
    """
    from .glossary_guard import looks_like_person_name

    parts: List[Tuple[str, bool]] = []
    # 聖剣 = Holy Sword reads like a name but 剣 alone is just "sword".
    person = looks_like_person_name(entry.get('translatedTerm') or '')

    def add(p: str, standalone: bool = False):
        if p and (p, standalone) not in parts:
            parts.append((p, standalone))

    for src in _sources(entry):
        pieces = [p for p in _NAME_SPLIT.split(unicodedata.normalize('NFKC', src).strip()) if p]
        if len(pieces) > 1:
            for piece in pieces:
                p = normalize(piece)
                if len(p) >= 2:
                    add(p)
                elif person and _KANJI_RE.fullmatch(p or ''):
                    add(p, True)
            continue
        n = normalize(src)
        if len(n) < 2 or not _ALL_CJK_RE.match(n):
            continue
        for k in range(2, len(n)):
            add(n[:k])
            add(n[-k:])
        # A one-kanji given name after a kanji surname (小野寺誠 → 誠).
        if person and len(n) >= 3 and _KANJI_RE.fullmatch(n[-1]) and _KANJI_RE.fullmatch(n[-2]):
            add(n[-1], True)
    return parts


_OKURIGANA_TAIL = re.compile(f'^(.*[{_KANJI}])([ぁ-ゖ]{{2,}})$')


def inflection_stem(form: str) -> str:
    """
    Stem of a verb/adjective form for matching its inflections: everything up to the
    last kanji plus the first kana after it (震える → 震え, 色褪せない → 色褪せ).
    '' when the form does not end in two or more hiragana after a kanji.
    """
    m = _OKURIGANA_TAIL.match(form)
    return m.group(1) + m.group(2)[0] if m else ''


@lru_cache(maxsize=8192)
def form_pattern(form: str) -> 're.Pattern[str]':
    """Regex for a normalised form that lets a reading follow any kanji."""
    pieces = []
    for i, ch in enumerate(form):
        pieces.append(re.escape(ch))
        if i < len(form) - 1 and _KANJI_RE.match(ch):
            pieces.append(_READING_GAP)
    return re.compile(''.join(pieces))


@lru_cache(maxsize=4096)
def _standalone_pattern(kanji: str) -> 're.Pattern[str]':
    return re.compile(f'(?<![{_KANJI}]){re.escape(kanji)}(?![{_KANJI}])')


def entry_patterns(entry: Dict[str, Any], parts: Optional[bool] = None) -> List['re.Pattern[str]']:
    """
    Every pattern that counts as an occurrence of the entry. `parts` adds the name
    parts; None decides from the rendering (full names only).
    """
    forms = entry_forms(entry)
    pats = [form_pattern(f) for f in forms]
    # Matching only — duplicates are still decided on whole forms.
    pats.extend(form_pattern(st) for st in {inflection_stem(f) for f in forms} - {''} - set(forms))
    if parts is None:
        parts = is_full_name(entry)
    if parts:
        for p, standalone in name_parts(entry):
            pats.append(_standalone_pattern(p) if standalone else form_pattern(p))
    return pats


# ---------------------------------------------------------------------------
# Occurrence
# ---------------------------------------------------------------------------

def occurs(entry: Dict[str, Any], text_norm: str, parts: Optional[bool] = None) -> bool:
    """True when the entry occurs in already-normalised text."""
    return any(p.search(text_norm) for p in entry_patterns(entry, parts))


def count(entry: Dict[str, Any], text_norm: str, parts: Optional[bool] = None) -> int:
    """Occurrences in already-normalised text (the best-matching form counts)."""
    return max((len(p.findall(text_norm)) for p in entry_patterns(entry, parts)), default=0)


def filter_entries(glossary: List[Dict[str, Any]], raw_content: str) -> List[Dict[str, Any]]:
    """Glossary entries that occur in a chapter (pre-filter)."""
    text = normalize_text(raw_content)
    return [e for e in glossary if entry_forms(e) and occurs(e, text)]


# ---------------------------------------------------------------------------
# Duplicates
# ---------------------------------------------------------------------------

SAME = 'same'      # the new term is an existing entry under another spelling
ALIAS = 'alias'    # a different source spelling rendered exactly like an existing name/proper term


_TRAILING_READING = re.compile('[ぁ-ゖァ-ヺー()|]+$')


def _with_readings(a: str, b: str) -> bool:
    """
    True when `a` is `b` with inline readings between its kanji (杖じよう剣けん is 杖剣).
    A reading only at the end does not count: 生ちんぽ is not 生, 翠ちゃん is not 翠.
    """
    if len(b) < 2 or not _KANJI_RE.search(b):
        return False
    core = _TRAILING_READING.sub('', a)
    return core != b and form_pattern(b).fullmatch(core) is not None


def _same_source(new_forms: List[str], forms: List[str]) -> bool:
    if set(new_forms) & set(forms):
        return True
    return any(_with_readings(a, b) or _with_readings(b, a) for a in new_forms for b in forms)


def _adds_words(translated: str, base_translated: str) -> bool:
    """
    Does a rendering say more than its base plus an honorific? Ren-kun over Ren
    does not; Lady Sophia over Sophia does — that is a rendering choice of its own.
    """
    from .glossary_guard import name_tokens
    return not set(name_tokens(translated)) <= set(name_tokens(base_translated))


def find_duplicate(
    source_term: str,
    translated_term: str,
    entries: Iterable[Dict[str, Any]],
    exclude_id: Optional[str] = None,
    honorifics: bool = True,
) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    (SAME, entry) when the source term is already in the glossary in any spelling,
    (ALIAS, entry) when it is new but rendered exactly like an existing name or
    proper term (capitalised rendering), None otherwise. SAME wins over ALIAS.

    honorifics=False keeps 魔王様 and 魔王 apart — for entries a person adds by hand,
    who may want both.
    """
    new_forms = entry_forms({'sourceTerm': source_term}, honorifics)
    if not new_forms:
        return None
    from .glossary_guard import _capitalised
    new_key = rendering_key(translated_term) if _capitalised(translated_term) else ''
    alias_hit = None
    for e in entries:
        if exclude_id and e.get('id') == exclude_id:
            continue
        forms = entry_forms(e, honorifics)
        if not forms:
            continue
        if _same_source(new_forms, forms):
            # Matched only through a stripped honorific (ソフィア嬢 vs ソフィア): a
            # duplicate unless the rendering adds words of its own (Lady Sophia).
            exact = _same_source(entry_forms({'sourceTerm': source_term}, False), entry_forms(e, False))
            if exact or not translated_term or not _adds_words(translated_term, e.get('translatedTerm') or ''):
                return SAME, e
            continue
        if alias_hit is None and new_key and new_key == rendering_key(e.get('translatedTerm') or ''):
            alias_hit = e
    if alias_hit is not None:
        return ALIAS, alias_hit
    return None


def has_cjk(text: str) -> bool:
    return bool(_CJK_RE.search(text or ''))
