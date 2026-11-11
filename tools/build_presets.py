"""
Build LWNTL's built-in prompt presets from a Cowork prompt package.

The package holds one folder per language pair (JP-EN, CN-ID, …), each with:
    instruction.md   the translation rules
    start.md         the Cowork workflow (files, docx, glossary.md, QA pass)

LWNTL keeps the rules and replaces the workflow with its own contract: one
chapter per request, translated text, then a glossary table, then
<LWNTL_DONE/>. From start.md only what still applies is carried over — the
safety net (rules most often lost) and the glossary tiers, rewritten for the
table LWNTL parses. Everything about files, docx scripts, splitting and the QA
pass belongs to LWNTL itself and is dropped.

Usage:
    python tools/build_presets.py "C:/Users/Ran/Downloads/Cowork Prompt"

Writes core/presets/<PAIR>.md and core/presets/index.json. Re-run it whenever
the package changes; user presets (duplicates) are never touched.
"""

import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "core" / "presets"

LANG = {"JP": "Japanese", "CN": "Chinese", "KR": "Korean", "EN": "English", "ID": "Indonesian"}

# Example rows for the glossary table and the partial-name rule, per source.
EXAMPLES = {
    "JP": ("魔王", "船坂叶馬", "Funasaka Touma", "叶馬", "Touma"),
    "CN": ("魔尊", "萧炎", "Xiao Yan", "萧", "Xiao"),
    "KR": ("마왕", "김서준", "Kim Seojun", "서준", "Seojun"),
    "EN": ("Demon King", "Alice Miller", "Alice Miller", "Alice", "Alice"),
    "ID": ("Raja Iblis", "Rina Kartika", "Rina Kartika", "Rina", "Rina"),
}
EXAMPLE_RENDERING = {
    ("JP", "EN"): "Demon King", ("CN", "EN"): "Demon Venerable", ("KR", "EN"): "Demon King",
    ("ID", "EN"): "Demon King", ("JP", "ID"): "Demon King", ("CN", "ID"): "Demon Venerable",
    ("KR", "ID"): "Demon King", ("EN", "ID"): "Demon King",
}

BAR = "═══════════════════════════════════════════════"

TEXT = {
    "EN": {
        "note": (
            "NOTE — HOW LWNTL RUNS THIS: each request carries ONE chapter between `--- START CONTENT ---` "
            "and `--- END CONTENT ---`. Everything else in this prompt — the glossary, summaries of earlier "
            "chapters, long-term memory, and \"Look Up\" (the finished translation of the previous chapter or "
            "chapters) — is REFERENCE for consistency only. Never re-translate, quote, continue, or summarize "
            "it; translate only the content between the markers. The output contract and the glossary table "
            "are at the end of this document."
        ),
        "formatting": "(Output is plain Markdown: paragraphs separated by one blank line, `*italics*` for inner monologue and SFX, never `**bold**`.)",
        "illustration": (
            "(In LWNTL a placeholder arrives wrapped as `<LWNTL_PRESERVE>Image PlaceHolder: file.jpg</LWNTL_PRESERVE>`. "
            "Copy that whole line exactly as it is — tags included — as its own paragraph at the same position.)"
        ),
        "glossary_ref": "(What counts as a new entry, and how to list it, is in GLOSSARY TABLE at the end.)",
        "safety_title": "SAFETY NET",
        "safety_intro": "Repeated here because these are the rules most often lost:",
        "safety_fix": (
            "- If the provided glossary already contains an entry that breaks one of these rules, use the CORRECT "
            "form in the translation anyway, and list the corrected rendering in your glossary table with the note "
            "\"correction\". A bad glossary entry must not propagate."
        ),
        "contract_title": "OUTPUT CONTRACT — READ BEFORE ANSWERING",
        "contract": """Your response has exactly two parts, in this order, and nothing else:

1. **The translated chapter** — start immediately, with no preamble.
2. **A separator line `---`, then the GLOSSARY TABLE** of new terms (below), then end the response with `<LWNTL_DONE/>`.

A response without part 2, or with an incomplete character list in part 2, is INCOMPLETE — even if part 1 is perfect. Never write translator's notes, explanations, apologies, summaries, or commentary of any kind.

MANDATORY CHECK before writing the table: count the scene markers in the source and in your translation — the numbers must match exactly. Count the source's dialogue lines too — every one must have its own paragraph in the translation. Confirm the chapter is translated to its very last line.""",
        "table_title": "GLOSSARY TABLE",
        "table_intro": "After the translation and the `---` separator, list the terms that appear in this chapter and are **not already in the provided glossary**:",
        "table_rules": [
            "- The **Source Term** column holds the original script exactly as it appears in the source — never a romanization, never the translation. A Latin-only entry in this column for a non-Latin source is a broken row.",
            "- The **Translated Term** column holds the form you actually used in the text.",
            "- Only new terms — never repeat an entry that is already in the glossary, and never list the same term twice.",
            "- **Partial names:** when only part of a character's name appears and the full name is already in the glossary, use the matching word of the full-name entry ({full} = {full_r} → {part} = {part_r}). Never invent a new romanization for a part of a name, and never add a part with a different reading.",
            "- If there are truly no new terms, write exactly: `| - | - | No new terms in this chapter |`",
        ],
        "table_before": "Before writing the table, run through every character name that appears in the chapter — including those mentioned only once — and check each against the provided glossary. Every name that is not there yet MUST be in the table.",
        "end": "End the response with:",
        "notes_col": "Notes",
    },
    "ID": {
        "note": (
            "CATATAN — CARA LWNTL MENJALANKAN INI: setiap permintaan membawa SATU bab di antara `--- START CONTENT ---` "
            "dan `--- END CONTENT ---`. Semua bagian lain di prompt ini — glosarium, ringkasan bab sebelumnya, memori "
            "jangka panjang, dan \"Look Up\" (terjemahan jadi dari bab sebelumnya) — adalah REFERENSI untuk konsistensi "
            "saja. Jangan menerjemahkan ulang, mengutip, melanjutkan, atau meringkasnya; terjemahkan hanya konten di "
            "antara penanda itu. Kontrak output dan tabel glosarium ada di akhir dokumen ini."
        ),
        "formatting": "(Output berupa Markdown biasa: paragraf dipisah satu baris kosong, `*miring*` untuk monolog batin dan SFX, jangan pernah `**tebal**`.)",
        "illustration": (
            "(Di LWNTL placeholder datang terbungkus sebagai `<LWNTL_PRESERVE>Image PlaceHolder: file.jpg</LWNTL_PRESERVE>`. "
            "Salin baris itu persis apa adanya — termasuk tag-nya — sebagai paragraf tersendiri di posisi yang sama.)"
        ),
        "glossary_ref": "(Apa yang termasuk entri baru, dan cara menulisnya, ada di TABEL GLOSARIUM di akhir.)",
        "safety_title": "JARING PENGAMAN",
        "safety_intro": "Diulang di sini karena inilah aturan yang paling sering terlupa:",
        "safety_fix": (
            "- Jika glosarium yang diberikan sudah terlanjur berisi entri yang melanggar salah satu aturan ini, tetap "
            "tulis bentuk yang BENAR di terjemahan, dan cantumkan bentuk yang sudah dikoreksi di tabel glosarium dengan "
            "catatan \"koreksi\". Entri glosarium yang salah tidak boleh menular."
        ),
        "contract_title": "KONTRAK OUTPUT — BACA SEBELUM MENJAWAB",
        "contract": """Responsmu terdiri dari tepat dua bagian, berurutan, tanpa apa pun selain itu:

1. **Teks terjemahan bab itu** — langsung dimulai, tanpa pembuka.
2. **Satu baris pemisah `---`, lalu TABEL GLOSARIUM** istilah baru (di bawah), lalu akhiri respons dengan `<LWNTL_DONE/>`.

Respons tanpa bagian 2, atau dengan daftar tokoh yang tidak lengkap di bagian 2, dianggap TIDAK LENGKAP — sekalipun bagian 1 sempurna. Jangan pernah menulis catatan penerjemah, penjelasan, permintaan maaf, ringkasan, atau komentar dalam bentuk apa pun.

CEK WAJIB sebelum menulis tabel: hitung penanda adegan di sumber dan di terjemahanmu — angkanya harus sama persis. Hitung juga baris dialog di sumber — setiap baris dialog harus punya paragrafnya sendiri di terjemahan. Pastikan bab diterjemahkan sampai baris terakhirnya.""",
        "table_title": "TABEL GLOSARIUM",
        "table_intro": "Setelah terjemahan dan pemisah `---`, daftarkan istilah yang muncul di bab ini dan **belum ada di glosarium yang diberikan**:",
        "table_rules": [
            "- Kolom **Source Term** berisi aksara asli persis seperti di sumber — tidak pernah romanisasi, tidak pernah terjemahannya. Entri berhuruf Latin saja di kolom ini untuk sumber non-Latin adalah baris rusak.",
            "- Kolom **Translated Term** berisi bentuk yang benar-benar kamu pakai di teks.",
            "- Hanya istilah baru — jangan mengulang entri yang sudah ada di glosarium, dan jangan menulis istilah yang sama dua kali.",
            "- **Nama sebagian:** jika hanya sebagian nama tokoh yang muncul dan nama lengkapnya sudah ada di glosarium, pakai kata yang sesuai dari entri nama lengkap itu ({full} = {full_r} → {part} = {part_r}). Jangan membuat romanisasi baru untuk bagian nama, dan jangan memasukkan bagian nama dengan bacaan berbeda.",
            "- Jika benar-benar tidak ada istilah baru: tulis persis `| - | - | Tidak ada istilah baru di bab ini |`",
        ],
        "table_before": "Sebelum menulis tabel, telusuri setiap nama tokoh yang muncul di bab — termasuk yang hanya disebut sekali — dan cocokkan dengan glosarium yang diberikan. Setiap nama yang belum ada WAJIB masuk tabel.",
        "end": "Akhiri respons dengan:",
        "notes_col": "Notes",
    },
}


def sections(md: str):
    """[(title, body)] for blocks shaped  BAR / # TITLE / BAR / body."""
    out = []
    parts = re.split(r"^═{10,}\s*\n(# .+?)\n═{10,}\s*$", md, flags=re.M)
    for i in range(1, len(parts), 2):
        # A stray bar left over from an empty block is not content.
        body = "\n".join(ln for ln in parts[i + 1].splitlines() if not re.fullmatch(r"═{10,}\s*", ln))
        out.append((parts[i][2:].strip(), body.strip()))
    return out


def find(secs, *prefixes):
    for title, body in secs:
        if any(title.upper().startswith(p) for p in prefixes):
            return body
    return ""


def convert_rules(ins: str, t: dict) -> str:
    # The workflow note → how LWNTL feeds the chapter.
    ins = re.sub(r"^(NOTE|CATATAN): (This document|Dokumen ini).*$", t["note"], ins, count=1, flags=re.M)
    ins = re.sub(r"^\((The exact formatting mechanics|Mekanisme format persis)[^)]*\)\s*$", t["formatting"], ins, flags=re.M)
    ins = re.sub(r"\((HOW|CARA) [^)]*(workflow|alur input/output)[^)]*\)", t["illustration"], ins)
    ins = re.sub(r"\((What counts as a glossary entry|Apa yang termasuk entri glosarium)[^)]*\)", t["glossary_ref"], ins)
    leftover = re.findall(r".*(input/output workflow|alur input/output|instruction\.md|glossary\.md).*", ins)
    if leftover:
        raise SystemExit(f"unconverted workflow reference left: {leftover[:3]}")
    return ins.rstrip()


def convert_safety(body: str, t: dict) -> str:
    lines = []
    for ln in body.splitlines():
        if re.match(r"^(Repeated here|Diulang di sini)", ln):
            lines.append(t["safety_intro"])
        elif re.match(r"^- (If|Jika) `glossary\.md`", ln):
            lines.append(t["safety_fix"])
        else:
            lines.append(ln)
    return "\n".join(lines).strip()


def convert_tiers(body: str, t: dict) -> str:
    """Glossary maintenance bullets from start.md, retargeted at the table."""
    keep = []
    for ln in body.splitlines():
        if not ln.startswith("- "):
            continue
        if re.search(r"(cumulative|kumulatif)", ln, re.I):
            continue
        if re.search(r"`\{Source\}`", ln):
            continue  # restated by the table rules
        ln = ln.replace("in the third field", "in the Notes column").replace("di kolom ketiga", "di kolom Notes")
        ln = re.sub(r"\s*(No duplicates|Tanpa duplikat)\.", "", ln)
        keep.append(ln)
    return "\n".join(keep)


def build_pair(pair_dir: Path) -> dict:
    src, tgt = pair_dir.name.split("-")
    t = TEXT[tgt]
    ins = (pair_dir / "instruction.md").read_text(encoding="utf-8")
    start = (pair_dir / "start.md").read_text(encoding="utf-8")
    secs = sections(start)

    safety = find(secs, "SAFETY NET", "ROMANIZATION SAFETY NET", "JARING PENGAMAN")
    tiers = find(secs, "GLOSSARY MAINTENANCE", "PEMELIHARAAN GLOSARIUM")
    if not safety or not tiers:
        raise SystemExit(f"{pair_dir.name}: safety net or glossary section not found in start.md")

    ex_src, full, full_r, part, part_r = EXAMPLES[src]
    example_row = f"| {ex_src} | {EXAMPLE_RENDERING[(src, tgt)]} | {'main antagonist' if tgt == 'EN' else 'antagonis utama'} |"
    rules = [r.format(full=full, full_r=full_r, part=part, part_r=part_r) for r in t["table_rules"]]

    doc = "\n".join([
        convert_rules(ins, t),
        "",
        BAR, f"# {t['safety_title']}", BAR,
        convert_safety(safety, t),
        "",
        BAR, f"# {t['contract_title']}", BAR,
        t["contract"],
        "",
        BAR, f"# {t['table_title']}", BAR,
        t["table_intro"],
        "",
        convert_tiers(tiers, t),
        "",
        t["table_before"],
        "",
        "```",
        "| Source Term | Translated Term | Notes |",
        "|-------------|-----------------|-------|",
        example_row,
        "```",
        "",
        *rules,
        "",
        t["end"],
        "<LWNTL_DONE/>",
        "",
    ])
    title = ins.splitlines()[0].lstrip("# ").strip()
    variant = re.search(r"^(THIS VARIANT|VARIAN INI): (?:the focus is |fokusnya (?:pada|adalah) )?([A-ZÀ-ɏ]+)", ins, re.M)
    (OUT / f"{pair_dir.name}.md").write_text(doc, encoding="utf-8", newline="\n")
    return {
        "id": f"builtin:{pair_dir.name}",
        "pair": pair_dir.name,
        "name": f"{src} → {tgt}" + (f" · {variant.group(2).capitalize()}" if variant else ""),
        "title": title,
        "sourceLanguage": LANG[src],
        "targetLanguage": LANG[tgt],
        "file": f"{pair_dir.name}.md",
    }


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    pkg = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    index = [build_pair(d) for d in sorted(pkg.iterdir()) if d.is_dir() and re.fullmatch(r"[A-Z]{2}-[A-Z]{2}", d.name)]
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for e in index:
        print(f"{e['id']:<16} {e['name']:<22} {(OUT / e['file']).stat().st_size:>6} bytes")


if __name__ == "__main__":
    main()
