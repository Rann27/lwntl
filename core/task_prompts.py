"""
Task Prompts — editable prompts for the helper passes around translation.

Three passes call the model with their own instructions:

    revision   second look at a finished draft (Revision Pass)
    autofix    replace leaked CJK words inline (AutoFix CJK)
    prepass    propose glossary terms from raw source (Terminology Pre-Pass)

Each prompt has two halves:

    guidance   what the user may edit — tone, rules, priorities. Stored per
               profile in templates.json; blank means "use the built-in default".
    contract   the output format the code parses (JSON shape, "text only").
               Always appended by code, never editable, so a custom prompt
               cannot break parsing.

Built-in defaults exist in English and Indonesian; the one matching the series'
target language is picked automatically, so a profile that translates into both
languages still gets fitting defaults. A custom template overrides both.

Template variables: {source_language}, {target_language}, {title}.
"""

from typing import Any, Dict

KINDS = ("revision", "autofix", "prepass")

TEMPLATE_KEYS = {
    "revision": "revisionPromptTemplate",
    "autofix": "autofixPromptTemplate",
    "prepass": "prepassPromptTemplate",
}


# ---------------------------------------------------------------------------
# Revision
# ---------------------------------------------------------------------------

_REVISION_EN = """# Revision Pass — {target_language} Light Novel Prose

You are revising an existing {target_language} translation of a {source_language} light novel.
The draft is already accurate. Your job is prose quality, not re-translation.

## Never
- Re-translate. Work from the draft.
- Change meaning, add content, remove content, or alter named entities.
- Merge paragraphs. You may split a paragraph only to give two speakers their own lines.
- Touch glossary terms, honorifics, or retained {source_language} terms
  (onii-chan, onee-sama, fufu, ara ara, and similar).
- Add, remove, or restyle scene markers (◆, ◇, ★, ***).

## Fix
1. Structural repetition — consecutive paragraphs that open the same way or reuse
   the same rhythm. Vary the construction.
2. Redundant attribution — delete a standalone "X said that." paragraph when the
   speaker is already unambiguous from the dialogue. Keep attribution that carries
   real information: a new speaker, an action, an expression.
3. Flat phrasing — reach for what a good novelist would write, without inflating
   the register beyond what the source supports.
4. Translationese — anything that reads as translated rather than written.
5. Rhythm — vary sentence length. Let scenes breathe.

The source is provided for reference only, to confirm you have not drifted from
its meaning. Never use it to re-translate."""

_REVISION_ID = """# Revision Pass — Prosa Light Novel {target_language}

Kamu merevisi terjemahan {target_language} yang sudah ada dari sebuah light novel {source_language}.
Draf sudah akurat. Tugasmu adalah kualitas prosa dan DIKSI, bukan menerjemahkan ulang.

## Jangan pernah
- Menerjemahkan ulang. Bekerja dari draf.
- Mengubah makna, menambah isi, mengurangi isi, atau mengubah entitas bernama.
- Menggabungkan paragraf. Memecah paragraf hanya boleh untuk memisahkan ucapan dua tokoh.
- Mengubah istilah glosarium, honorifik, sapaan saudara (onii-chan, onee-sama), atau
  ciri verbal yang dipertahankan (fufu, ara ara).
- Menerjemahkan istilah genre ke Bahasa Indonesia (dungeon, skill, level, guild, party,
  potion, System Window tetap Inggris).
- Menambah, menghapus, atau mengubah bentuk penanda adegan (◆, ◇, ★, ***).
- Menambah metafora, kalimat transisi, atau kalimat penutup yang tidak ada di sumber.

## Perbaiki
1. Pembuka metronom — paragraf berturut-turut yang dibuka pola sama ("Saat ...",
   "Ketika ...", "Setelah itu, ..."). Rombak konstruksinya, jangan sekadar ganti sinonim.
2. Atribusi redundan — hapus paragraf berdiri sendiri "X berkata begitu." / "kata X."
   jika penuturnya sudah jelas. Pertahankan atribusi yang membawa informasi nyata.
3. Intensifier kosong — "benar-benar", "sungguh", "begitu sangat", "tak dapat dipungkiri".
   Ganti dengan kata kerja dan detail yang kuat.
4. Diksi yang menyempit — satu kata Indonesia yang dipakai untuk beberapa kata sumber
   berbeda. Cek sumbernya: kata sumber sama → biarkan (itu tic); berbeda → kembalikan
   gradasinya. Jangan memvariasikan kata tanpa alasan dari sumber.
5. Bahasa terjemahan — kalimat yang terasa diterjemahkan, bukan ditulis. Baris pendek
   harus terdengar seperti ucapan penutur asli ("Berisik.", bukan "Kamu berisik.").
6. Ritme — variasikan panjang kalimat. Tempatkan kata terkuat di posisi yang menggigit.

Sumber diberikan hanya sebagai referensi, untuk memastikan makna tidak bergeser.
Jangan memakainya untuk menerjemahkan ulang."""

_REVISION_CONTRACT = """

## Output
- Reproduce every line wrapped in <LWNTL_PRESERVE> tags byte-for-byte, at the same position.
- Separate paragraphs with one blank line.
- Output the revised text only — no commentary, notes, explanations, or glossary table."""


# ---------------------------------------------------------------------------
# AutoFix CJK
# ---------------------------------------------------------------------------

_AUTOFIX_EN = """You repair a {target_language} light/web-novel translation in which a few individual words randomly leaked in their original CJK form (Japanese kana/kanji or Korean hangul). These are ordinary everyday words.

For each item you receive the leaked 'cjk' fragment and a 'context' snippet showing how it is used. Return the correct inline replacement for that fragment in that context.

RULES:
- Match the surrounding tone and grammatical form.
- A CJK word can carry several meanings; choose the one this context needs.
- Onomatopoeia becomes a natural {target_language} sound or description, never romaji.
- Names are romanized with digraphs (Yuuko, Kyouya), never macrons."""

_AUTOFIX_ID = """Kamu memperbaiki terjemahan light/web novel {target_language} yang di dalamnya beberapa kata tersisa dalam aksara aslinya (kana/kanji Jepang atau hangul Korea). Biasanya ini kata sehari-hari biasa.

Setiap item berisi potongan 'cjk' yang bocor dan cuplikan 'context' yang menunjukkan cara kata itu dipakai. Berikan pengganti yang tepat untuk potongan itu, di konteks itu.

ATURAN:
- Sesuaikan dengan nada dan bentuk gramatikal kalimat di sekitarnya.
- Satu kata CJK bisa punya beberapa arti; pilih yang dibutuhkan konteks ini.
- Onomatope diadaptasi menjadi bunyi atau deskripsi Indonesia yang natural, jangan romaji.
- Nama diromanisasi dengan digraf (Yuuko, Kyouya), jangan pernah macron.
- Istilah genre tetap Bahasa Inggris (skill, dungeon, level, guild).
- Honorifik dan sapaan saudara dipertahankan dalam romaji (-san, onii-chan)."""

_AUTOFIX_CONTRACT = """

OUTPUT:
- 'fix' must be pure {target_language} with NO CJK characters at all.
- Give ONLY the replacement word(s) that slot directly in place of the cjk fragment — no added punctuation, quotes, or surrounding words.
- Output ONLY a JSON array like [{{"id":0,"fix":"..."}},{{"id":1,"fix":"..."}}] — no markdown, no prose."""


# ---------------------------------------------------------------------------
# Terminology pre-pass
# ---------------------------------------------------------------------------

_PREPASS_EN = """You are a terminology lead preparing a {source_language}-to-{target_language} light/web novel translation.

You are given RAW SOURCE TEXT (not a translation). Identify the recurring terms a translator must render identically every time, and decide the {target_language} form to use.

INCLUDE:
- Character names, nicknames, epithets, titles
- Place, organization, faction, and group names
- Skills, spells, techniques, abilities
- Weapons, items, artifacts, equipment
- World-specific concepts, ranks, systems, races
- Any recurring compound noun whose rendering could plausibly vary (this matters more than whether it is a proper noun)

EXCLUDE:
- Ordinary vocabulary with a single obvious rendering
- One-off descriptive phrases that do not recur

TRANSLATION RULES:
- Romanize names with digraphs for long vowels (Yuuko, Kyouya, Souta) — never macrons. Real-world places keep their standard spelling (Tokyo, Osaka).
- Keep honorific suffixes and sibling address terms romanized (-san, onii-chan) when they are part of how a character is addressed.
- Pick ONE canonical form per term and stay consistent.
- For every character, give the full name AND each part that appears on its own in the text (surname, given name) as separate entries, using the same romanization as the full name: 船坂叶馬 → Funasaka Touma, 叶馬 → Touma. Never give a part a different reading.
- Keep 'notes' to a short role/context hint; for characters include gender."""

_PREPASS_ID = """Kamu adalah penanggung jawab terminologi untuk penerjemahan light/web novel {source_language} ke {target_language}.

Kamu diberi TEKS SUMBER MENTAH (bukan terjemahan). Temukan istilah berulang yang wajib diterjemahkan sama persis setiap kali, lalu tetapkan bentuk {target_language}-nya.

SERTAKAN:
- Nama tokoh, nama panggilan, julukan, gelar
- Nama tempat, organisasi, faksi, kelompok
- Skill, sihir, teknik, kemampuan
- Senjata, item, artefak, perlengkapan
- Konsep khas dunia, rank, sistem, ras
- Kata benda majemuk berulang yang terjemahannya bisa bervariasi

KECUALIKAN:
- Kosakata biasa dengan satu terjemahan yang jelas
- Frasa deskriptif sekali muncul

ATURAN TERJEMAHAN:
- Nama diromanisasi dengan digraf untuk vokal panjang (Yuuko, Kyouya, Souta) — jangan pernah macron. Tempat dunia nyata memakai ejaan baku (Tokyo, Osaka).
- Istilah genre dirender dalam Bahasa Inggris: nama skill/magic, monster, ras, gelar (賢者 → Sage, 勇者 → Hero, 魔王 → Demon King), item dan UI sistem, istilah RPG (dungeon, guild, party, level, rank).
- Honorifik dan sapaan saudara dipertahankan dalam romaji (-san, -kun, onii-chan, onee-sama).
- Tetapkan SATU bentuk baku per istilah.
- Untuk setiap tokoh, berikan nama lengkap DAN setiap bagian nama yang muncul sendiri di teks (nama keluarga, nama depan) sebagai entri terpisah, dengan romanisasi yang sama: 船坂叶馬 → Funasaka Touma, 叶馬 → Touma. Jangan pernah memberi bacaan berbeda untuk bagian nama.
- 'notes' singkat: peran/konteks; untuk tokoh sertakan gender."""

_PREPASS_CONTRACT = """

SOURCE TERM RULES — strict:
- 'sourceTerm' MUST be written in the original {source_language} script, exactly as it appears in the text. Never put the translation there.
- Raw text often interleaves furigana readings between kanji, e.g. '【 杖 じよう 剣 けん 】'. Strip the readings and give the base form: '杖剣'.
- For a name written with furigana such as 叶馬（とうま）, use the kanji: 叶馬
- 'translatedTerm' must be pure {target_language} with no {source_language} characters, except honorifics/cultural terms conventionally kept romanized.

OUTPUT — a JSON array only, no markdown fences, no prose:
[{{"sourceTerm":"魔王","translatedTerm":"Demon King","notes":"main antagonist"}}]
Return [] if nothing qualifies."""


_DEFAULTS = {
    "revision": {"en": _REVISION_EN, "id": _REVISION_ID},
    "autofix": {"en": _AUTOFIX_EN, "id": _AUTOFIX_ID},
    "prepass": {"en": _PREPASS_EN, "id": _PREPASS_ID},
}

_CONTRACTS = {
    "revision": _REVISION_CONTRACT,
    "autofix": _AUTOFIX_CONTRACT,
    "prepass": _PREPASS_CONTRACT,
}


def lang_code(target_language: str) -> str:
    return "id" if (target_language or "").strip().lower().startswith("indonesia") else "en"


def default_guidance(kind: str, target_language: str = "English") -> str:
    return _DEFAULTS[kind][lang_code(target_language)]


def all_defaults() -> Dict[str, Dict[str, str]]:
    """Every built-in guidance text, for the template editor's "load default" buttons."""
    return {k: dict(v) for k, v in _DEFAULTS.items()}


def _custom_guidance(kind: str) -> str:
    try:
        from .storage.templates import get_profile_templates
        return (get_profile_templates().get(TEMPLATE_KEYS[kind]) or "").strip()
    except Exception:
        return ""


def build_task_prompt(kind: str, source_language: str = "Japanese",
                      target_language: str = "English", title: str = "") -> str:
    """Guidance (custom or default) + fixed output contract, with variables resolved."""
    from .prompt_builder import is_blank_prompt, resolve_template_vars

    guidance = _custom_guidance(kind)
    if not guidance or is_blank_prompt(guidance):
        guidance = default_guidance(kind, target_language)

    series_like: Dict[str, Any] = {
        "sourceLanguage": source_language or "Japanese",
        "targetLanguage": target_language or "English",
        "title": title or "",
    }
    contract = _CONTRACTS[kind].format(
        source_language=series_like["sourceLanguage"],
        target_language=series_like["targetLanguage"],
    )
    return resolve_template_vars(guidance, series_like) + contract
