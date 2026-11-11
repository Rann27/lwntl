"""
QA i18n — Indonesian wording for QA findings.

Detectors write their `detail` in English: the review agent reads it, and English
keeps the model's instructions in one language. The UI shows `detailId` instead
when the app runs in Indonesian. Rather than threading a second string through
every detector, each English message is listed here once as a template, and
localize() matches a finished message back to its template and fills the
Indonesian one with the same values.

A message with no template here falls back to English — test_qa_i18n keeps
every detector covered.
"""

import re
from functools import lru_cache
from typing import List, Optional, Tuple

# (English template, Indonesian template). {name} is a value carried over as is.
TEMPLATES: List[Tuple[str, str]] = [
    # residual source
    ("{lang} characters left in the translation", "Masih ada aksara {lang} di terjemahan"),
    ("Looks untranslated — {lang} function words left in", "Sepertinya belum diterjemahkan — masih ada kata fungsi bahasa {lang}"),
    ("「」 left in the text — must be double quotes", "Masih ada 「」 di teks — harus jadi tanda petik ganda"),
    ("Full-width punctuation (、。，！？：；) left in", "Masih ada tanda baca lebar penuh (、。，！？：；)"),
    ("Chinese long dash —— left in (use one em dash —)", "Masih ada garis panjang China —— (pakai satu em dash —)"),
    ("Japanese ellipsis …… left in", "Masih ada elipsis Jepang ……"),
    ("Box-drawing dash ─ left in (use an em dash —)", "Masih ada garis kotak ─ (pakai em dash —)"),
    ("LaTeX-style quotes `` or ''", "Tanda petik gaya LaTeX `` atau ''"),
    ("Japanese brackets 『』【】〈〉《》 — allowed, but verify", "Kurung Jepang 『』【】〈〉《》 — boleh, tapi periksa"),
    ("A Cyrillic/Greek letter inside a Latin word — looks right, never matches",
     "Huruf Sirilik/Yunani menyamar di kata Latin — tampak benar, tapi tidak pernah cocok saat dicari"),
    # romanization
    ("Pinyin tone mark or ü — use plain Pinyin (Lín → Lin, Lǚ → Lu)", "Tanda nada Pinyin atau ü — pakai Pinyin polos (Lín → Lin, Lǚ → Lu)"),
    ("ŏ / ŭ in a romanized word — use Revised Romanization (eo, eu)", "ŏ / ŭ di kata beromanisasi — pakai Revised Romanization (eo, eu)"),
    ("McCune-Reischauer apostrophe (k', t', p', ch') — Revised Romanization has none",
     "Apostrof McCune-Reischauer (k', t', p', ch') — Revised Romanization tidak memakainya"),
    ("Macron in a romanized word — use digraphs (Yuu, Kyouya)", "Macron di kata beromanisasi — pakai digraf (Yuu, Kyouya)"),
    # markup
    ("Bold markup — only italics are allowed", "Format tebal — hanya miring yang diizinkan"),
    ("Odd number of * — an italic span is not closed", "Jumlah * ganjil — ada huruf miring yang tidak ditutup"),
    ("Space inside an italic delimiter breaks rendering", "Spasi di dalam penanda miring merusak tampilan"),
    ("Standalone attribution paragraph — delete if the speaker is already clear",
     "Paragraf atribusi berdiri sendiri — hapus jika pembicaranya sudah jelas"),
    # address, leftovers
    ("Address in plain words inside dialogue — if the source has a retained term "
     "(hyung, oppa, sunbae, -nim, onii-chan …) as address, restore it",
     "Sapaan diterjemahkan biasa di dalam dialog — jika sumbernya memakai sapaan yang dipertahankan "
     "(hyung, oppa, sunbae, -nim, onii-chan …), kembalikan bentuk itu"),
    ("Sibling address in plain words inside dialogue — check the source (onii-chan, onee-sama, …)",
     "Sapaan saudara diterjemahkan biasa di dalam dialog — cek sumbernya (onii-chan, onee-sama, …)"),
    ("Pinyin address term left in — translate it (Master, Senior Brother, Young Master …)",
     "Istilah sapaan Pinyin belum diterjemahkan — terjemahkan (Guru, Kakak Seperguruan, Tuan Muda …)"),
    ("Pinyin interjection or sound effect — adapt it", "Interjeksi atau efek suara Pinyin — adaptasikan"),
    ("Sentence-final particle (ba / ne / la / ma) left in", "Partikel akhir kalimat (ba / ne / la / ma) masih tertinggal"),
    ("Romanized Korean that should be translated or adapted (aigoo, heol, ajusshi, hoobae …)",
     "Romanisasi Korea yang seharusnya diterjemahkan atau diadaptasi (aigoo, heol, ajusshi, hoobae …)"),
    ("Korean name ending -ah / -ya left on a name", "Akhiran nama Korea -ah / -ya masih menempel di nama"),
    ("Indonesian sound effect or a literal genre back-translation — adapt it",
     "Efek suara Indonesia atau terjemahan balik istilah genre yang harfiah — adaptasikan"),
    ("Genre term rendered in Indonesian — keep it English (dungeon, skill, potion, guild, party)",
     "Istilah genre diterjemahkan ke Indonesia — biarkan Inggris (dungeon, skill, potion, guild, party)"),
    ("Romanized sound effect — adapt it", "Efek suara masih romaji — adaptasikan"),
    ("Long repeated-letter run — verify this and the neighbouring paragraphs against the source",
     "Deretan huruf berulang yang panjang — cek paragraf ini dan tetangganya ke sumber"),
    ("One line of dialogue mixes kau / kamu / Anda — one speaker, one register",
     "Satu baris dialog mencampur kau / kamu / Anda — satu pembicara, satu register"),
    # quotes, spacing, spelling
    ("Unbalanced double quotes — a line of dialogue lost a quote (fine only if the speech continues into the next paragraph)",
     "Tanda petik tidak seimbang — ada dialog yang kehilangan petiknya (wajar hanya jika ucapannya berlanjut ke paragraf berikutnya)"),
    ("Stacked double quotes (simultaneous-speech convention) — use one pair or split the line",
     "Petik ganda bertumpuk (konvensi ucapan serentak) — pakai satu pasang petik atau pecah barisnya"),
    ("Possible missing space between words", "Mungkin ada spasi yang hilang di antara kata"),
    ("Non-standard spelling “{word}” — standard form: {good}", "Ejaan tidak baku “{word}” — bentuk baku: {good}"),
    ("Pronoun “anda” should be capitalised: Anda", "Kata ganti “anda” harus diawali huruf kapital: Anda"),
    ("se- with a hyphen is only for foreign words, abbreviations or numbers",
     "se- dengan tanda hubung hanya untuk kata asing, singkatan, atau angka"),
    ("Space before punctuation, double space, or -- instead of —", "Spasi sebelum tanda baca, spasi ganda, atau -- alih-alih —"),
    ("Acronym written in lowercase", "Akronim ditulis huruf kecil"),
    ("Stock phrase that is rarely in the source — check it is not invented",
     "Frasa klise yang jarang ada di sumber — pastikan bukan karangan"),
    ("Straight and curly double quotes are mixed ({a} vs {b} paragraphs)",
     "Petik lurus dan melengkung bercampur ({a} vs {b} paragraf)"),
    ("Next to a long letter run — corruption often lands here", "Bersebelahan dengan deretan huruf panjang — kerusakan sering terjadi di sini"),
    ("A correction that repeats “{word}” from the line before — possible dead wordplay; verify against the source",
     "Koreksi yang mengulang “{word}” dari baris sebelumnya — mungkin permainan kata yang mati; cek ke sumber"),
    ("{n} narrative paragraphs open with {openers} — vary them", "{n} paragraf narasi dibuka dengan {openers} — variasikan"),
    ("{n} consecutive paragraphs open with “{word}”", "{n} paragraf berturut-turut dibuka dengan “{word}”"),
    # structure, coverage
    ("Same paragraph already appears at index {i}", "Paragraf yang sama sudah muncul di indeks {i}"),
    ("Illustration placeholder(s) missing: {files}", "Placeholder ilustrasi hilang: {files}"),
    ("Scene markers: source has {a}, translation has {b} — markers were invented",
     "Penanda adegan: sumber {a}, terjemahan {b} — ada penanda yang dikarang"),
    ("Scene markers: source has {a}, translation has {b} — markers were dropped",
     "Penanda adegan: sumber {a}, terjemahan {b} — ada penanda yang hilang"),
    ("Scene marker {k} is “{b}” but the source has “{a}”", "Penanda adegan ke-{k} berbentuk “{b}”, sedangkan di sumber “{a}”"),
    ("Source has {a} dialogue lines, translation only {b} — dialogue may have been dropped or merged",
     "Sumber punya {a} baris dialog, terjemahan hanya {b} — ada dialog yang hilang atau tergabung"),
    ("This section is much shorter than its source ({a} vs {b} source chars) — content may be missing",
     "Bagian ini jauh lebih pendek dari sumbernya ({a} vs {b} karakter sumber) — mungkin ada isi yang hilang"),
    ("This section has {a} dialogue lines, the source {b}", "Bagian ini punya {a} baris dialog, sumbernya {b}"),
    ("Paragraphs {p1}–{p2} are much shorter than source lines {s1}–{s2} ({a} vs {b} chars) — sentences may be missing",
     "Paragraf {p1}–{p2} jauh lebih pendek dari baris sumber {s1}–{s2} ({a} vs {b} karakter) — mungkin ada kalimat yang hilang"),
    ("Last paragraph has no closing punctuation — the chapter may be cut off",
     "Paragraf terakhir tanpa tanda baca penutup — bab mungkin terpotong"),
    # glossary
    ("Glossary term {src} appears in the source but its locked rendering “{tgt}” never appears in the translation",
     "Istilah glosarium {src} ada di sumber, tapi terjemahan terkuncinya “{tgt}” tidak pernah muncul di terjemahan"),
    ("“{used}” is used for {src}, but the glossary locks “{tgt}”",
     "“{used}” dipakai untuk {src}, padahal glosarium mengunci “{tgt}”"),
    ("“{used}” is used for {src} — a longer form of the locked “{tgt}”; verify the source has the longer name",
     "“{used}” dipakai untuk {src} — bentuk lebih panjang dari “{tgt}” yang terkunci; pastikan sumbernya memang menyebut nama panjang itu"),
    ("{name} is locked as male in the glossary, but this paragraph only uses she/her — verify against the source",
     "{name} terkunci sebagai laki-laki di glosarium, tapi paragraf ini hanya memakai she/her — cek ke sumber"),
    ("{name} is locked as female in the glossary, but this paragraph only uses he/him — verify against the source",
     "{name} terkunci sebagai perempuan di glosarium, tapi paragraf ini hanya memakai he/him — cek ke sumber"),
    # volume (qa_scan)
    ("Translation is {pct}% of the volume's usual length for this much source — content may be missing",
     "Panjang terjemahan {pct}% dari biasanya untuk sumber sepanjang ini — mungkin ada isi yang hilang"),
    ("Translation is {pct}% of the volume's usual length for this much source — content may be duplicated or invented",
     "Panjang terjemahan {pct}% dari biasanya untuk sumber sepanjang ini — mungkin ada isi ganda atau karangan"),
]

# Words inside messages that are themselves translated.
_WORDS = {"Japanese": "Jepang", "Chinese": "China", "Korean": "Korea", "English": "Inggris", "Indonesian": "Indonesia"}


@lru_cache(maxsize=1)
def _compiled():
    out = []
    for en, idn in TEMPLATES:
        parts = re.split(r"(\{\w+\})", en)
        rx = "".join(f"(?P<{p[1:-1]}>.+?)" if re.fullmatch(r"\{\w+\}", p) else re.escape(p) for p in parts)
        out.append((re.compile("^" + rx + "$", re.S), idn))
    return out


def localize(detail: str) -> Optional[str]:
    """Indonesian wording of an English finding message, or None when there is no template."""
    for rx, idn in _compiled():
        m = rx.match(detail or "")
        if m:
            values = {k: _WORDS.get(v, v) for k, v in m.groupdict().items()}
            return idn.format(**values)
    return None
