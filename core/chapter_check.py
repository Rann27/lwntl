"""
Chapter Check — deterministic QA for one translated chapter (no AI, no tokens).

This is Step A of the QA pass in the agentic workflow (start.md): every detector
that can be decided from text alone. Nothing here edits text — findings feed the
QA report, the safe-fix pass (core/qa_fix.py) and the repair agent.

Each finding names a paragraph index into the translated body (glossary table
excluded), so a reader or agent can jump to exactly that paragraph.

Severity:
    high    content is wrong or missing — must be fixed
    medium  rule violation or likely error — should be fixed
    low     signal to verify against the source; often fine

`fix` on a finding names the safe-fix category that repairs it mechanically
(see qa_fix.SAFE_CATEGORIES); findings without it need judgment.

Detectors (numbers follow start.md Step A):
     1 residual source characters / marks       11 pronoun mixing (ID)
     2 macrons                                  12 unbalanced quotes
     3 bold, unclosed italics, italic spacing   13 stacked double quotes
     4 redundant attribution                    14 run-together words
     5 metronome openers                        15 non-standard spelling (ID)
     6 flattened sibling address                16 hyphen / spacing / punctuation
     7 genre terms translated (ID)              17 lowercase acronyms (ID)
     8 name variants          (volume, qa_scan) 18 phrase frequency (volume, qa_scan)
     9 long letter runs + neighbours            19 scene marker count and form
    10 quote style drift                        20 corrections that do not correct
  plus: duplicate paragraphs, missing placeholders, dialogue coverage, per-segment
  coverage (localises omissions), glossary adherence, romaji SFX, slop phrases,
  possible truncation.

Source-aware (the per-pair start.md files): how a source dialogue line opens
(「 for Japanese, “ for Chinese, " for Korean/English/Indonesian) drives every
coverage check, and each source adds its own leftovers — Pinyin tone marks and
untranslated address terms (shifu, gege) for Chinese, hangul jamo, ŏ/ŭ and
romanized interjections (aigoo, -ah) for Korean, untranslated English or
Indonesian sentences for EN→ID / ID→EN. English targets also get glossary
gender checks and lowercase acronyms.
"""

import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from .extractor import strip_glossary_table
from .placeholder import collect_placeholder_filenames, is_placeholder_line

# ---------------------------------------------------------------------------
# Shared patterns
# ---------------------------------------------------------------------------

CJK_LETTER = re.compile(r'[぀-ゟァ-ヺー-ヿ㐀-䶿一-鿿가-힯]')
_JAMO = re.compile(r'[ㄱ-ㆎ]')
_DIALOGUE_BRACKETS = re.compile(r'[「」]')
_OTHER_BRACKETS = re.compile(r'[『』【】〈〉《》]')
# Full-width punctuation from any CJK source (、。 Japanese; ，！？：； Chinese).
_JP_PUNCT = re.compile(r'[、。，！？：；（）]')
_LONG_DASH = re.compile(r'——')
_JP_ELLIPSIS = re.compile(r'……|‥')
_BOX_DASH = re.compile(r'[─━]')
_LATEX_QUOTES = re.compile(r"``|''")
MACRON = re.compile(r'[āīūēōĀĪŪĒŌ]')
# Pinyin tone marks (and ü). Loanwords that keep an accent in English are exempt.
PINYIN_TONE = re.compile(r"[A-Za-z]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙÜ][A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]*")
TONE_LOANWORDS = {"café", "cafés", "résumé", "naïve", "fiancé", "fiancée", "cliché", "clichés", "déjà",
                  "pokémon", "über", "entrée", "protégé", "rosé", "touché", "sauté", "soufflé", "doppelgänger"}
# McCune-Reischauer marks a Korean name should not carry (Revised Romanization only).
KR_DIACRITIC = re.compile(r'[ŏŭŎŬ]')
_KR_MR_APOSTROPHE = re.compile(r"[KkTtPpCc]h?'[aeiouwy]")
_HOMOGLYPH = re.compile(r'[A-Za-z][Ѐ-ӿͰ-Ͽ]|[Ѐ-ӿͰ-Ͽ][A-Za-z]')
_LONG_RUN = re.compile(r'([A-Za-z])\1{4,}')
_ITALIC_SPACING = re.compile(r'(?:^|\s)\*\s+[^*\n]+?\*|\*[^*\s][^*\n]*?\s+\*(?=\s|$|[.,!?])')
_STACKED_QUOTES = re.compile(r'""|“\s*“|”\s*”|^"\s*"')
_RUN_TOGETHER = re.compile(r'\b[a-z]{2,}[A-Z][a-z]+\b')
_LONG_TOKEN = re.compile(r'\b[A-Za-z]{21,}\b')
_SPACE_BEFORE_PUNCT = re.compile(r'[^\s] +(?:[,;:!?]|\.(?!\.))')
_DOUBLE_SPACE = re.compile(r'\S  +\S')
_DOUBLE_HYPHEN = re.compile(r'(?<!-)--(?!-)')

_MARKER_SYMBOLS = '◆◇★☆■□◎●○♦◈❖✦✧'
_SCENE_MARKER_LINE = re.compile(
    r'^\s*(?:'
    r'[' + _MARKER_SYMBOLS + r'](?:\s*[' + _MARKER_SYMBOLS + r'])*'
    r'|(?:\*\s*){3,}'
    r'|＊(?:\s*＊)*'
    r'|[-―─━—=]{3,}'
    r'|[~〜～]{3,}'
    r')\s*$'
)

# Words whose plain-language rendering flattens a retained address term.
_FLATTENED = {
    "en": re.compile(r'\b(big brother|big sis(?:ter)?|older sister|older brother|elder sister|elder brother)\b', re.I),
    # "kakak beradik", "adik kelas" and similar describe relations — not an address.
    "id": re.compile(r'\b(kakak|kak|abang|adik)\b(?![- ](?:beradik|kelas|tingkat|ipar|sepupu|adik|kandung))', re.I),
}

# Kept as "(source, target)": which plain-language address words flatten a
# retained term. Chinese translates its address terms, so it has none.
_FLATTENED_BY_PAIR = {
    ("kr", "en"): re.compile(r'\b(big bro(?:ther)?|big sis(?:ter)?|older sister|older brother|senior|Mr\.|Ms\.)', re.I),
    ("kr", "id"): re.compile(r'\b(kakak|kak|abang|bang|mbak|senior|pak|bu)\b', re.I),
    ("en", "id"): re.compile(r'\b(kakak|kak|abang|bang|mbak|adik|senior|junior|om|tante|pak|bu)\b', re.I),
}

# Chinese: Pinyin words that should have been translated.
_PINYIN_NOUNS = re.compile(r'\b(shifu|shizun|shixiong|shijie|shidi|shimei|gege|jiejie|meimei|didi|gongzi|'
                           r'xiaojie|daren|qianbei|wangye)\b', re.I)
_PINYIN_INTERJECTION = re.compile(r'\b(aiya+|aiyo+|aiyaya)\b', re.I)
_PINYIN_PARTICLE = re.compile(r'\b(ba|ne|la|ma)\s*[!?.~…]*["”]?\s*$')
_PINYIN_SFX = re.compile(r'\*\s*(peng|hong|kacha|weng)\b', re.I)
# Korean: romanized interjections / SFX and terms that should have been translated.
_KR_ROMANIZED = re.compile(r'\b(aigoo+|aigo|heol|daebak|omo|kkk+|jinjja|ajusshi|ahjussi|ajumma|ahjumma|'
                           r'hoobae|seonsaengnim|sajangnim)\b', re.I)
# A name with -ah / -ya, not a drawn-out sound (Kyaa-ah-ah, Hick-ah).
_KR_NAME_ENDING = re.compile(r'(?<![-\w])([A-Z][a-z]{2,})-(?:ah|ya)\b(?!-)')
# Indonesian source: its onomatopoeia and literal back-translations of genre words.
_ID_SFX = re.compile(r'\b(deg-degan|cklek|ceklek|bruk|byur|gedebuk|gubrak)\b', re.I)
_ID_BACKTRANSLATED = re.compile(r'\b(underground prison|Saint Sword)\b', re.I)
# Function words that give away an untranslated sentence (EN→ID, ID→EN).
_RESIDUAL_WORDS = {
    "en": re.compile(r'\b(the|and|with|that|because|would|should|there|which)\b'),
    "id": re.compile(r'\b(yang|dan|dengan|tidak|adalah|untuk|dari|itu|ini|akan|sudah|karena|kepada)\b'),
}
_SOURCE_NAME = {"jp": "Japanese", "cn": "Chinese", "kr": "Korean", "en": "CJK", "id": "CJK"}

# How a line of dialogue opens in each source language.
_SOURCE_DIALOGUE_OPEN = {
    "jp": ("「",),
    "cn": ("“", "「", '"', "『"),
    "kr": ('"', "“", "「"),
    "en": ('"', "“"),
    "id": ('"', "“"),
}

_ROMAJI_SFX_WORDS = (r'doki[ -]?doki|gacha|suya[ -]?suya|munya[ -]?munya|pekori|fuwa[ -]?fuwa|'
                     r'zawa[ -]?zawa|niko[ -]?niko|kusu[ -]?kusu|poko[ -]?poko|gyuu?|piku|bikku?')
# "kira-kira" is ordinary Indonesian ("about", "I wonder"), so it is English-only here.
_ROMAJI_SFX = {
    "en": re.compile(r'\b(' + _ROMAJI_SFX_WORDS + r'|kira[ -]?kira)\b', re.I),
    "id": re.compile(r'\b(' + _ROMAJI_SFX_WORDS + r')\b', re.I),
}

# Indonesian renderings of genre terms that must stay English.
_GENRE_ID = re.compile(r'\b(penjara bawah tanah|keterampilan|ramuan|jendela sistem|serikat petualang|serikat|rombongan|'
                       r'inti emas|santo pedang|persediaan)\b', re.I)

_OPENERS = {
    "en": ("As ", "When ", "With that", "Then, "),
    "id": ("Saat ", "Ketika ", "Setelah itu", "Dengan begitu", "Lalu, "),
}

_ATTRIBUTION = {
    "en": [
        re.compile(r'^(?:[A-Z][\w\-]+(?: [A-Z][\w\-]+)?|He|She|They|I) (?:said|says|muttered|replied|answered|asked)(?: (?:that|so|this))?\.$'),
        re.compile(r'^(?:said|says|replied|asked) (?:[A-Z][\w\-]+|he|she)\.$', re.I),
    ],
    "id": [
        re.compile(r'^\S+(?: \S+)? (?:berkata|bilang|mengatakan|menjawab|bergumam|berucap|bertanya)(?: (?:begitu|seperti itu|demikian|itu))?\.$', re.I),
        re.compile(r'^(?:kata|ujar|ucap|tanya|jawab|gumam)(?:nya| \S+(?: \S+)?)\.$', re.I),
    ],
}

_CORRECTION = {
    "en": re.compile(r"\b(no,|not |i mean|i meant|wrong|that's not|that isn't)", re.I),
    "id": re.compile(r'\b(bukan|maksudku|maksudnya|salah|yang benar|eh,)', re.I),
}

_SLOP = {
    "en": re.compile(r"\b(couldn'?t help but|a testament to|little did (?:he|she|they|i) know|"
                     r"in that moment|time (?:seemed to )?(?:stop|stood still)|unbeknownst|"
                     r"a wave of \w+ washed over)\b", re.I),
    "id": re.compile(r'\b(tak dapat dipungkiri|tidak dapat dipungkiri|seolah-olah waktu berhenti|'
                     r'dan begitulah|tanpa disadari|momen itu terasa|waktu seakan berhenti)\b', re.I),
}

# Indonesian pronoun sets that should not mix inside one line of dialogue.
_PRON_KAU = re.compile(r'\b(kau|engkau)\b', re.I)
_PRON_KAMU = re.compile(r'\bkamu\b', re.I)
_PRON_ANDA = re.compile(r'\bAnda\b')

# (standard, non-standard) — non-standard forms are flagged; prefix match covers
# suffixed forms (nafasnya → napasnya).
EJAAN_ID: List[Tuple[str, str]] = [
    ("napas", "nafas"), ("bernapas", "bernafas"), ("risiko", "resiko"), ("praktik", "praktek"),
    ("analisis", "analisa"), ("zaman", "jaman"), ("silakan", "silahkan"), ("hakikat", "hakekat"),
    ("aktivitas", "aktifitas"), ("nasihat", "nasehat"), ("antre", "antri"), ("izin", "ijin"),
    ("karier", "karir"), ("telur", "telor"), ("apotek", "apotik"), ("sekadar", "sekedar"),
    ("imbau", "himbau"), ("mengimbau", "menghimbau"), ("mengubah", "merubah"), ("diubah", "dirubah"),
    ("memengaruhi", "mempengaruhi"), ("provinsi", "propinsi"), ("ekstrem", "ekstrim"),
    ("jadwal", "jadual"), ("kualitas", "kwalitas"), ("frekuensi", "frekwensi"), ("atlet", "atlit"),
    ("objek", "obyek"), ("teknik", "tehnik"), ("cendekiawan", "cendikiawan"),
]
EJAAN_ID_RE = [(good, re.compile(r'\b(' + bad + r')([a-z]*)\b', re.I)) for good, bad in EJAAN_ID]
ANDA_LOWER = re.compile(r'\banda\b')

ACRONYMS_ID = ("sks", "tv", "cd", "dvd", "sim", "ktp", "kk", "npwp", "sms", "atm", "osis", "uks")
ACRONYM_ID_RE = re.compile(r'\b(' + '|'.join(ACRONYMS_ID) + r')\b')
ACRONYMS_EN = ("tv", "dvd", "cd", "pc", "usb", "atm", "cctv", "gps", "sms")
ACRONYM_EN_RE = re.compile(r'\b(' + '|'.join(ACRONYMS_EN) + r')\b')
ACRONYM_RE = {"id": ACRONYM_ID_RE, "en": ACRONYM_EN_RE}

# Glossary notes that lock a character's gender.
_MALE_NOTE = re.compile(r'\b(male|laki-laki|pria|cowok|boy|man)\b', re.I)
_FEMALE_NOTE = re.compile(r'\b(female|perempuan|wanita|cewek|girl|woman)\b', re.I)
_HE = re.compile(r'\b(he|him|his|himself)\b', re.I)
_SHE = re.compile(r'\b(she|her|hers|herself)\b', re.I)

_HYPHEN_SE = re.compile(r'\bse-[a-z]{3,}\b')
_TERMINAL = re.compile(r'[.!?…"”’\')\]*~—―\-♪❤]\s*$')


def lang_code(target_language: str) -> str:
    return "id" if (target_language or "").strip().lower().startswith("indonesia") else "en"


def source_code(source_language: str) -> str:
    """'jp', 'cn', 'kr', 'en' or 'id' for the source; unknown sources behave as Japanese."""
    from .prompt_presets import lang_code as pair_code
    return {"JP": "jp", "CN": "cn", "KR": "kr", "EN": "en", "ID": "id"}.get(pair_code(source_language), "jp")


def is_source_dialogue(line: str, src: str = "jp") -> bool:
    """Does this raw line open a line of dialogue in that source language?"""
    return line.strip().startswith(_SOURCE_DIALOGUE_OPEN.get(src, ("「",)))


def is_scene_marker(text: str) -> bool:
    return bool(_SCENE_MARKER_LINE.match(text or ""))


def split_paragraphs(text: str) -> List[str]:
    """Paragraphs of a translated body, as the editor and exporter see them."""
    return [p.strip() for p in (text or "").split("\n\n") if p.strip()]


def is_dialogue(paragraph: str) -> bool:
    return paragraph.lstrip().startswith(('"', '“', '「', "'"))


def _visible_chars(text: str) -> int:
    return len(re.sub(r'[\s*]', '', text or ""))


def _finding(kind: str, severity: str, para: Optional[int], detail: str,
             text: str = "", fix: str = "") -> Dict[str, Any]:
    from .qa_i18n import localize
    f = {"type": kind, "severity": severity, "para": para, "detail": detail,
         "detailId": localize(detail) or detail, "text": text[:180]}
    if fix:
        f["fix"] = fix
    return f


def _content_words(text: str, lang: str) -> set:
    words = re.findall(r"[a-z]{4,}", text.lower())
    return {w for w in words if w not in STOPWORDS[lang]}


STOPWORDS = {
    "en": set("""that this with have from they were been what when your said there their them then than
        into just like only some more about would could should which while because these those over
        very even back down will also here where after before again still really didn know think""".split()),
    "id": set("""yang dengan untuk dari pada akan juga saja sudah tidak bisa karena kalau tapi tetapi lagi
        masih hanya semua mereka kami kita sedang harus dalam atau jadi lalu kemudian sini sana situ
        bahwa oleh agar supaya setelah sebelum ketika saat nggak enggak memang begitu sekarang
        dirinya diriku itulah inilah adalah ialah bukan tidak kamu engkau anda dirimu aku saya
        kalian beliau sih deh kok dong lho kan yah nah begini gini gitu sekali banget""".split()),
}


# ---------------------------------------------------------------------------
# Segments — anchors that both sides preserve (scene markers, placeholders)
# ---------------------------------------------------------------------------

def _source_segments(raw_lines: List[str], src: str = "jp") -> List[Dict[str, int]]:
    segs = [{"chars": 0, "dialogue": 0}]
    for ln in raw_lines:
        s = ln.strip()
        if not s:
            continue
        if is_scene_marker(s) or is_placeholder_line(s):
            segs.append({"chars": 0, "dialogue": 0})
            continue
        segs[-1]["chars"] += _visible_chars(s)
        if is_source_dialogue(s, src):
            segs[-1]["dialogue"] += 1
    return segs


def _translated_segments(paras: List[str]) -> List[Dict[str, int]]:
    segs = [{"chars": 0, "dialogue": 0, "start": 0}]
    for i, p in enumerate(paras):
        if is_scene_marker(p) or is_placeholder_line(p):
            segs.append({"chars": 0, "dialogue": 0, "start": i + 1})
            continue
        segs[-1]["chars"] += _visible_chars(p)
        if is_dialogue(p):
            segs[-1]["dialogue"] += 1
    return segs


def dialogue_alignment_gaps(raw_lines: List[str], paras: List[str], src: str = "jp") -> List[Dict[str, int]]:
    """
    Align source and translation on their dialogue lines and measure what lies between.

    One dialogue line is one paragraph on both sides, so when the counts match the
    k-th source dialogue line (「…」, “…”, "…" depending on `src`) and the k-th
    quoted paragraph are the same utterance. Each gap
    (a dialogue line plus the narration after it, up to the next one) can then be
    compared directly. A gap whose translation is far shorter than its source is
    where sentences went missing — even when the chapter as a whole looks complete.

    Returns [] when the dialogue counts differ (alignment would be meaningless).
    """
    src_d = [i for i, ln in enumerate(raw_lines) if is_source_dialogue(ln, src)]
    tr_d = [i for i, p in enumerate(paras) if is_dialogue(p)]
    if len(src_d) < 4 or len(src_d) != len(tr_d):
        return []
    s_bounds = [0] + src_d + [len(raw_lines)]
    t_bounds = [0] + tr_d + [len(paras)]
    gaps = []
    for k in range(len(s_bounds) - 1):
        sa, sb, ta, tb = s_bounds[k], s_bounds[k + 1], t_bounds[k], t_bounds[k + 1]
        if sa == sb and ta == tb:
            continue
        src_chars = sum(_visible_chars(ln) for ln in raw_lines[sa:sb]
                        if ln.strip() and not is_placeholder_line(ln.strip()) and not is_scene_marker(ln))
        tr_chars = sum(_visible_chars(p) for p in paras[ta:tb]
                       if not is_placeholder_line(p) and not is_scene_marker(p))
        gaps.append({"src_start": sa, "src_end": max(sa, sb - 1), "para_start": ta, "para_end": max(ta, tb - 1),
                     "src_chars": src_chars, "tr_chars": tr_chars})
    return gaps


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------

def check_chapter(
    raw_content: str,
    translated_content: str,
    glossary: Optional[List[Dict[str, Any]]] = None,
    target_language: str = "English",
    source_language: str = "Japanese",
    table_entries: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Run every per-chapter detector.

    `table_entries` are the chapter's stored glossary proposals (glossaryUpdates).
    They are passed in because a chapter whose model wrote no table carries them
    only there; without them the table is parsed from the translated content.

    Returns {"findings": [...], "stats": {...}}. Findings are ordered by severity,
    then paragraph.
    """
    lang = lang_code(target_language)
    src = source_code(source_language)
    flattened = _FLATTENED_BY_PAIR.get((src, lang)) if src in ("kr", "en") else (None if src == "cn" else _FLATTENED[lang])
    body = strip_glossary_table(translated_content or "")
    paras = split_paragraphs(body)
    raw = raw_content or ""
    raw_lines = raw.split("\n")
    findings: List[Dict[str, Any]] = []
    add = findings.append

    straight_q = curly_q = 0
    first_straight = first_curly = None
    pron = Counter()

    for i, p in enumerate(paras):
        if is_placeholder_line(p):
            continue
        marker = is_scene_marker(p)
        dialogue = is_dialogue(p)

        # 1 — residual source
        if CJK_LETTER.search(p) or (src == "kr" and _JAMO.search(p)):
            add(_finding("residual_source", "high", i, f"{_SOURCE_NAME[src]} characters left in the translation", p))
        residual_rx = _RESIDUAL_WORDS.get(src) if src in ("en", "id") and src != lang else None
        if residual_rx and not marker and len(residual_rx.findall(p.replace("*", ""))) >= 3:
            add(_finding("residual_source_language", "medium", i,
                         f"Looks untranslated — {'English' if src == 'en' else 'Indonesian'} function words left in", p))
        if _DIALOGUE_BRACKETS.search(p):
            add(_finding("residual_brackets", "high", i, "「」 left in the text — must be double quotes", p, "marks"))
        if not marker:
            if _JP_PUNCT.search(p):
                add(_finding("residual_punct", "medium", i, "Full-width punctuation (、。，！？：；) left in", p, "marks"))
            # —— is the Chinese long dash; from Japanese it is a common, accepted rendering of ――.
            if src == "cn" and _LONG_DASH.search(p):
                add(_finding("residual_dash", "low", i, "Chinese long dash —— left in (use one em dash —)", p, "marks"))
            if _JP_ELLIPSIS.search(p):
                add(_finding("residual_ellipsis", "medium", i, "Japanese ellipsis …… left in", p, "marks"))
            if _BOX_DASH.search(p):
                add(_finding("residual_dash", "medium", i, "Box-drawing dash ─ left in (use an em dash —)", p, "marks"))
        if _LATEX_QUOTES.search(p):
            add(_finding("latex_quotes", "medium", i, "LaTeX-style quotes `` or ''", p, "marks"))
        if _OTHER_BRACKETS.search(p):
            add(_finding("other_brackets", "low", i, "Japanese brackets 『』【】〈〉《》 — allowed, but verify", p))

        # Letters from another script disguised as Latin (Cyrillic о in "Toyоashihara")
        if _HOMOGLYPH.search(p):
            add(_finding("homoglyph", "medium", i,
                         "A Cyrillic/Greek letter inside a Latin word — looks right, never matches", p))

        # 2 — romanization marks
        if src == "cn":
            if any(w.lower() not in TONE_LOANWORDS for w in PINYIN_TONE.findall(p)):
                add(_finding("tone_mark", "medium", i, "Pinyin tone mark or ü — use plain Pinyin (Lín → Lin, Lǚ → Lu)", p, "tone"))
        elif src == "kr":
            if KR_DIACRITIC.search(p):
                add(_finding("kr_diacritic", "medium", i, "ŏ / ŭ in a romanized word — use Revised Romanization (eo, eu)", p, "tone"))
            if _KR_MR_APOSTROPHE.search(p):
                add(_finding("kr_apostrophe", "low", i, "McCune-Reischauer apostrophe (k', t', p', ch') — Revised Romanization has none", p))
        elif MACRON.search(p):
            add(_finding("macron", "medium", i, "Macron in a romanized word — use digraphs (Yuu, Kyouya)", p, "macron"))

        # 3 — markup
        if "**" in p:
            add(_finding("bold", "medium", i, "Bold markup — only italics are allowed", p, "bold"))
        if not marker and p.replace("**", "").count("*") % 2:
            add(_finding("unclosed_italic", "medium", i, "Odd number of * — an italic span is not closed", p))
        elif not marker and _ITALIC_SPACING.search(p):
            add(_finding("italic_spacing", "low", i, "Space inside an italic delimiter breaks rendering", p, "italic_spacing"))

        # 4 — redundant attribution
        if len(p) <= 60 and not dialogue and any(rx.match(p) for rx in _ATTRIBUTION[lang]):
            add(_finding("redundant_attribution", "low", i,
                         "Standalone attribution paragraph — delete if the speaker is already clear", p))

        # 6 — flattened address (only inside dialogue; narration may describe)
        if dialogue and flattened is not None and flattened.search(p):
            if src in ("kr", "en"):
                add(_finding("flattened_address", "low", i,
                             "Address in plain words inside dialogue — if the source has a retained term "
                             "(hyung, oppa, sunbae, -nim, onii-chan …) as address, restore it", p))
            else:
                add(_finding("flattened_address", "medium", i,
                             "Sibling address in plain words inside dialogue — check the source "
                             "(onii-chan, onee-sama, …)", p))

        # 6/7 — leftovers specific to the source language
        if src == "cn":
            if _PINYIN_NOUNS.search(p):
                add(_finding("pinyin_term", "medium", i,
                             "Pinyin address term left in — translate it (Master, Senior Brother, Young Master …)", p))
            if _PINYIN_INTERJECTION.search(p) or _PINYIN_SFX.search(p):
                add(_finding("pinyin_interjection", "medium", i, "Pinyin interjection or sound effect — adapt it", p))
            elif dialogue and _PINYIN_PARTICLE.search(p):
                add(_finding("pinyin_particle", "low", i, "Sentence-final particle (ba / ne / la / ma) left in", p))
        elif src == "kr":
            if _KR_ROMANIZED.search(p):
                add(_finding("kr_romanized", "medium", i,
                             "Romanized Korean that should be translated or adapted (aigoo, heol, ajusshi, hoobae …)", p))
            if any(not re.search(r'(.)\1', m.group(1).lower()) for m in _KR_NAME_ENDING.finditer(p)):
                add(_finding("kr_name_ending", "medium", i, "Korean name ending -ah / -ya left on a name", p))
        elif src == "id" and lang == "en":
            if _ID_SFX.search(p) or _ID_BACKTRANSLATED.search(p):
                add(_finding("id_leftover", "low", i,
                             "Indonesian sound effect or a literal genre back-translation — adapt it", p))

        # 7 — genre terms translated
        if lang == "id" and _GENRE_ID.search(p):
            add(_finding("genre_term_translated", "medium", i,
                         "Genre term rendered in Indonesian — keep it English (dungeon, skill, potion, guild, party)", p))

        if _ROMAJI_SFX[lang].search(p):
            add(_finding("romaji_sfx", "medium", i, "Romanized sound effect — adapt it", p))

        # 9 — long letter run: corruption tends to land next to it
        if _LONG_RUN.search(p):
            add(_finding("long_letter_run", "low", i,
                         "Long repeated-letter run — verify this and the neighbouring paragraphs against the source", p))

        # 10 — quote style (counted here, judged below)
        if '"' in p:
            straight_q += 1
            if first_straight is None:
                first_straight = i
        if '“' in p or '”' in p:
            curly_q += 1
            if first_curly is None:
                first_curly = i

        # 11 — pronoun mixing inside one line of dialogue (ID)
        if lang == "id" and dialogue:
            has_kau, has_kamu, has_anda = bool(_PRON_KAU.search(p)), bool(_PRON_KAMU.search(p)), bool(_PRON_ANDA.search(p))
            pron["kau"] += has_kau
            pron["kamu"] += has_kamu
            pron["Anda"] += has_anda
            if sum((has_kau, has_kamu, has_anda)) > 1:
                add(_finding("pronoun_mix", "medium", i,
                             "One line of dialogue mixes kau / kamu / Anda — one speaker, one register", p))

        # 12 — unbalanced quotes
        if p.count('"') % 2 or p.count('“') != p.count('”'):
            add(_finding("unbalanced_quotes", "medium", i,
                         "Unbalanced double quotes — a line of dialogue lost a quote "
                         "(fine only if the speech continues into the next paragraph)", p))

        # 13 — stacked quotes
        if _STACKED_QUOTES.search(p):
            add(_finding("stacked_quotes", "medium", i,
                         "Stacked double quotes (simultaneous-speech convention) — use one pair or split the line", p))

        # 14 — run-together words
        if _RUN_TOGETHER.search(p) or _LONG_TOKEN.search(p):
            add(_finding("run_together", "low", i, "Possible missing space between words", p))

        # 15 — non-standard spelling (ID)
        if lang == "id":
            for good, rx in EJAAN_ID_RE:
                m = rx.search(p)
                if m:
                    add(_finding("ejaan", "low", i, f"Non-standard spelling “{m.group(0)}” — standard form: {good}", p, "ejaan"))
            if ANDA_LOWER.search(p):
                add(_finding("ejaan", "low", i, "Pronoun “anda” should be capitalised: Anda", p, "ejaan"))

        # 16 — hyphen, spacing, punctuation
        if lang == "id" and _HYPHEN_SE.search(p):
            add(_finding("hyphen_se", "low", i, "se- with a hyphen is only for foreign words, abbreviations or numbers", p))
        if not marker and (_SPACE_BEFORE_PUNCT.search(p) or _DOUBLE_SPACE.search(p) or _DOUBLE_HYPHEN.search(p)):
            add(_finding("typography", "low", i, "Space before punctuation, double space, or -- instead of —", p, "typography"))

        # 17 — lowercase acronyms
        if ACRONYM_RE[lang].search(p):
            add(_finding("acronym_case", "low", i, "Acronym written in lowercase", p, "acronym"))

        if _SLOP[lang].search(p):
            add(_finding("slop_phrase", "low", i, "Stock phrase that is rarely in the source — check it is not invented", p))

    # 10 — quote style drift (chapter-level)
    if straight_q and curly_q:
        minority_first = first_curly if straight_q >= curly_q else first_straight
        add(_finding("quote_style_mix", "medium", minority_first,
                     f"Straight and curly double quotes are mixed ({straight_q} vs {curly_q} paragraphs)",
                     fix="quotes" if straight_q >= curly_q else ""))

    # 9 — neighbours of long runs
    runs = [f["para"] for f in findings if f["type"] == "long_letter_run"]
    for r in runs:
        for j in (r - 1, r + 1):
            if 0 <= j < len(paras) and j not in runs:
                add(_finding("near_long_run", "low", j, "Next to a long letter run — corruption often lands here", paras[j]))

    # 20 — corrections that do not correct
    for i in range(1, len(paras)):
        p, prev = paras[i], paras[i - 1]
        if len(p) > 140 or not (is_dialogue(p) and is_dialogue(prev)):
            continue
        m = _CORRECTION[lang].search(p)
        if m and m.start() <= 25:
            shared = _content_words(p, lang) & _content_words(prev, lang)
            if shared:
                add(_finding("correction_check", "low", i,
                             f"A correction that repeats “{sorted(shared)[0]}” from the line before — "
                             "possible dead wordplay; verify against the source", p))

    # 5 — metronome openers
    narrative = [i for i, p in enumerate(paras) if not is_dialogue(p) and not is_scene_marker(p)]
    opener_idx = [i for i in narrative if paras[i].startswith(_OPENERS[lang])]
    opener_ratio = len(opener_idx) / max(len(narrative), 1)
    if len(narrative) >= 20 and opener_ratio > 0.12:
        add(_finding("metronome_openers", "low", opener_idx[0] if opener_idx else None,
                     f"{len(opener_idx)} narrative paragraphs open with "
                     f"{', '.join(o.strip() for o in _OPENERS[lang])} — vary them"))
    streak_word, streak_start, streak = None, 0, 0
    for i, p in enumerate(paras + [""]):
        w = p.split(" ", 1)[0] if p and not is_dialogue(p) else None
        if w and w == streak_word:
            streak += 1
        else:
            if streak >= 3:
                add(_finding("repeated_opener", "low", streak_start,
                             f"{streak} consecutive paragraphs open with “{streak_word}”"))
            streak_word, streak_start, streak = w, i, 1

    # Duplicates
    seen: Dict[str, int] = {}
    for i, p in enumerate(paras):
        key = p.strip()
        if len(key) < 60:
            continue
        if key in seen:
            add(_finding("duplicate_paragraph", "high", i, f"Same paragraph already appears at index {seen[key]}", p))
        else:
            seen[key] = i

    # Placeholders
    src_ph = collect_placeholder_filenames(raw)
    out_ph = collect_placeholder_filenames(body)
    missing_ph = [f for f in src_ph if f not in out_ph]
    if missing_ph:
        add(_finding("missing_placeholder", "high", None, f"Illustration placeholder(s) missing: {', '.join(missing_ph)}"))

    # 19 — scene markers: count and form
    src_markers = [ln.strip() for ln in raw_lines if is_scene_marker(ln)]
    out_markers = [p for p in paras if is_scene_marker(p)]
    if len(src_markers) != len(out_markers):
        add(_finding("scene_marker_count", "high", None,
                     f"Scene markers: source has {len(src_markers)}, translation has {len(out_markers)} — "
                     + ("markers were invented" if len(out_markers) > len(src_markers) else "markers were dropped")))
    else:
        for k, (a, b) in enumerate(zip(src_markers, out_markers)):
            sym_a = re.sub(r'\s', '', a)
            sym_b = re.sub(r'\s', '', b)
            if sym_a and sym_a[0] in _MARKER_SYMBOLS and sym_a != sym_b:
                add(_finding("scene_marker_form", "medium", paras.index(b),
                             f"Scene marker {k + 1} is “{b}” but the source has “{a}”", b))

    # Dialogue coverage (whole chapter)
    src_dialogue = sum(1 for ln in raw_lines if is_source_dialogue(ln, src))
    out_dialogue = sum(1 for p in paras if is_dialogue(p))
    if src_dialogue >= 10 and out_dialogue < src_dialogue * 0.85:
        add(_finding("dialogue_coverage", "high", None,
                     f"Source has {src_dialogue} dialogue lines, translation only {out_dialogue} — "
                     "dialogue may have been dropped or merged"))

    # Per-segment coverage — localises omissions between anchors both sides keep
    src_chars = sum(_visible_chars(ln) for ln in raw_lines
                    if ln.strip() and not is_placeholder_line(ln.strip()) and not is_scene_marker(ln))
    out_chars = sum(_visible_chars(p) for p in paras if not is_placeholder_line(p) and not is_scene_marker(p))
    length_ratio = out_chars / src_chars if src_chars else 0.0
    s_segs, t_segs = _source_segments(raw_lines, src), _translated_segments(paras)
    if len(s_segs) == len(t_segs) > 1 and length_ratio:
        for s, t in zip(s_segs, t_segs):
            if s["chars"] >= 400 and t["chars"] / s["chars"] < 0.6 * length_ratio:
                add(_finding("segment_coverage", "high", t["start"],
                             f"This section is much shorter than its source "
                             f"({t['chars']} vs {s['chars']} source chars) — content may be missing"))
            elif s["dialogue"] >= 6 and t["dialogue"] < s["dialogue"] * 0.8:
                add(_finding("segment_coverage", "high", t["start"],
                             f"This section has {t['dialogue']} dialogue lines, the source {s['dialogue']}"))

    # Per-gap coverage between aligned dialogue lines — catches a few dropped
    # sentences that whole-chapter and per-segment ratios average away.
    if length_ratio:
        for g in dialogue_alignment_gaps(raw_lines, paras, src):
            if g["src_chars"] >= 200 and g["tr_chars"] / g["src_chars"] < 0.5 * length_ratio:
                add(_finding("gap_coverage", "medium", g["para_start"],
                             f"Paragraphs {g['para_start']}–{g['para_end']} are much shorter than source lines "
                             f"{g['src_start']}–{g['src_end']} ({g['tr_chars']} vs {g['src_chars']} chars) — "
                             "sentences may be missing", paras[g["para_start"]] if g["para_start"] < len(paras) else ""))

    # Possible truncation
    last_text = next((p for p in reversed(paras) if not is_placeholder_line(p) and not is_scene_marker(p)), "")
    if last_text and not _TERMINAL.search(last_text):
        add(_finding("possibly_truncated", "low", len(paras) - 1,
                     "Last paragraph has no closing punctuation — the chapter may be cut off", last_text))

    # Glossary adherence
    if glossary:
        from .term_match import normalize_text, occurs
        lowered = body.lower()
        raw_norm = normalize_text(raw)
        for entry in glossary:
            src = (entry.get("sourceTerm") or "").strip()
            tgt = (entry.get("translatedTerm") or "").strip()
            # Whole term only (any spelling): a full name whose given name alone
            # appears is legitimately rendered by that one word.
            if not src or not tgt or not occurs(entry, raw_norm, parts=False):
                continue
            # Single-character terms match inside unrelated words, and lowercase
            # common-word renderings legitimately inflect (cemburu → kecemburuan).
            # Only names and fixed proper terms are checked.
            if len(src) < 2 or not tgt[:1].isupper():
                continue
            if tgt.lower() not in lowered:
                add(_finding("glossary_miss", "medium", None,
                             f"Glossary term {src} appears in the source but its locked rendering "
                             f"“{tgt}” never appears in the translation"))

    # Glossary variants — the chapter's own table proposes another rendering for
    # a locked term, and the text really uses it. Only names and fixed proper
    # terms: a lowercase common-word rendering legitimately inflects
    # (menebus → penebusan), and an honorific (Hosono-san) is not a new rendering.
    if glossary:
        from .extractor import parse_glossary_from_translation
        from .glossary_guard import name_tokens
        from .term_match import SAME, find_duplicate, rendering_key
        reported = set()
        proposals = table_entries if table_entries is not None else \
            parse_glossary_from_translation(translated_content or "").get("entries", [])
        for e in proposals:
            used = (e.get("translatedTerm") or "").strip()
            dup = find_duplicate(e.get("sourceTerm", ""), used, glossary)
            if not used or not dup or dup[0] != SAME:
                continue
            locked = (dup[1].get("translatedTerm") or "").strip()
            if (not locked[:1].isupper() or rendering_key(used) == rendering_key(locked)
                    or set(name_tokens(used)) <= set(name_tokens(locked)) or used.lower() in reported):
                continue
            reported.add(used.lower())
            rx = re.compile(r"(?<![\w])" + re.escape(used) + r"(?![\w])", re.I)
            longer = locked.lower() in used.lower()
            src_term = dup[1].get("sourceTerm", "")
            for i in [i for i, p in enumerate(paras) if rx.search(p)][:5]:
                if longer:
                    add(_finding("glossary_variant", "low", i,
                                 f"“{used}” is used for {src_term} — a longer form of the locked “{locked}”; "
                                 "verify the source has the longer name", paras[i]))
                else:
                    add(_finding("glossary_variant", "medium", i,
                                 f"“{used}” is used for {src_term}, but the glossary locks “{locked}”", paras[i]))

    # 11 — gender locked in the glossary vs the pronouns around the name (EN)
    if lang == "en" and glossary:
        chars = []
        for entry in glossary:
            notes = entry.get("notes") or ""
            male, female = bool(_MALE_NOTE.search(notes)), bool(_FEMALE_NOTE.search(notes))
            words = [w for w in re.findall(r"[A-Z][A-Za-z'\-]{2,}", entry.get("translatedTerm") or "")]
            if male != female and words:
                chars.append(("male" if male else "female", words, entry.get("translatedTerm")))
        for i, p in enumerate(paras):
            if is_dialogue(p) or is_placeholder_line(p):
                continue
            present = [c for c in chars if any(re.search(r"\b" + re.escape(w) + r"\b", p) for w in c[1])]
            # Only a paragraph about one locked character says anything about that
            # character — and only when it opens with them as the subject, and the
            # wrong pronoun follows in that same sentence.
            if len(present) != 1:
                continue
            gender, words, name = present[0]
            first = re.split(r"(?<=[.!?…])\s+", p.lstrip("*_ "), maxsplit=1)[0]
            if not any(first.startswith(w) for w in words):
                continue
            own, other = (_HE, _SHE) if gender == "male" else (_SHE, _HE)
            if other.search(first) and len(other.findall(p)) >= 2 and not own.search(p):
                add(_finding("gender_check", "low", i,
                             f"{name} is locked as {gender} in the glossary, but this paragraph only uses "
                             f"{'she/her' if gender == 'male' else 'he/him'} — verify against the source", p))

    order = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: (order.get(f["severity"], 3), f["para"] if f["para"] is not None else -1))

    return {
        "findings": findings,
        "stats": {
            "paragraphs": len(paras),
            "sourceDialogue": src_dialogue,
            "translatedDialogue": out_dialogue,
            "sceneMarkers": [len(src_markers), len(out_markers)],
            "placeholders": [len(src_ph), len(out_ph)],
            "sourceChars": src_chars,
            "translatedChars": out_chars,
            "lengthRatio": round(length_ratio, 3),
            "openerRatio": round(opener_ratio, 3),
            "quoteStyle": "mixed" if straight_q and curly_q else ("curly" if curly_q else "straight"),
            "pronouns": dict(pron),
            "high": sum(1 for f in findings if f["severity"] == "high"),
            "medium": sum(1 for f in findings if f["severity"] == "medium"),
            "low": sum(1 for f in findings if f["severity"] == "low"),
        },
    }


# ---------------------------------------------------------------------------
# Volume helpers (used by qa_scan and the volume agent)
# ---------------------------------------------------------------------------

def _vowel_key(word: str) -> str:
    w = word.lower().translate(str.maketrans("āīūēō", "aiueo"))
    return re.sub(r"(uu|ou|oo|ii|ee|aa)", lambda m: m.group(0)[0], w)


_TONE_STRIP = str.maketrans("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü", "aaaaeeeeiiiioooouuuuuuuuu")


def _pinyin_key(word: str) -> str:
    return word.lower().translate(_TONE_STRIP).replace(" ", "")


def _korean_key(word: str) -> str:
    w = word.lower().replace("ŏ", "eo").replace("ŭ", "eu")
    if w in ("lee", "yi", "rhee", "ri"):
        return "lee"
    w = w.replace("jeong", "jung")
    return w.replace("eo", "o").replace("eu", "u").replace("ae", "e")


_CAP_WORD = r"[A-ZÀ-ÞĀ-ʯ][a-zß-ÿĀ-ʯ]{2,}"


def volume_name_variants(texts: List[str], source_language: str = "Japanese") -> List[Dict[str, Any]]:
    """
    Capitalised names spelled more than one way across the volume:
        Japanese / other   long vowels and macrons      Yuuko / Yuko / Yūko
        Chinese            tone marks, joined or split  Lin Dong / Lindong / Lín Dòng
        Korean             eo/o, eu/u, ae/e, Lee/Yi, Jung/Jeong
    """
    src = source_code(source_language)
    caps: Counter = Counter()
    for t in texts:
        caps.update(re.findall(r"\b" + _CAP_WORD + r"\b", t))
        if src == "cn":
            caps.update(f"{a} {b}" for a, b in re.findall(r"\b(" + _CAP_WORD + r") (" + _CAP_WORD + r")\b", t))
    key = {"cn": _pinyin_key, "kr": _korean_key}.get(src, _vowel_key)
    groups: Dict[str, Dict[str, int]] = {}
    for w, n in caps.items():
        groups.setdefault(key(w), {})[w] = n
    return [{"forms": forms} for forms in groups.values() if len(forms) > 1]
