# LWNTL — LN/WN Translator (Remake) Specification

> Dokumen ini adalah spesifikasi lengkap untuk digunakan sebagai instruksi agent di Claude Code.
> Baca seluruh dokumen ini sebelum menulis satu baris kode pun.

---

## 1. Ringkasan Proyek

**LWNTL** (LN/WN Translator) adalah aplikasi **desktop GUI** untuk menerjemahkan Light Novel dan Web Novel berbahasa Jepang, Cina, dan Korea ke Bahasa Indonesia secara otomatis menggunakan ZhipuAI GLM API. Versi remake ini sepenuhnya **offline / file-based** (tidak ada database), dibangun sebagai desktop app dengan UI **Neobrutalism**, dan memiliki CRUD lengkap untuk semua entitas.

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework Desktop | **PyWebView** (Python backend + Web frontend) |
| Backend | Python 3.11+ |
| Frontend | React (TypeScript) + Tailwind CSS |
| AI Engine | Multi-provider: ZhipuAI (`zai-sdk`) + Alibaba Cloud Qwen (`openai`-compatible) |
| Storage | File-based JSON — tidak ada database |
| Build | **PyInstaller** → single `.exe` / `.app` |
| Font | **Space Grotesk** (display/heading) + **Inter** (body) |
| Icons | **Lucide React** |

**Mengapa PyWebView:** Arsitektur identik dengan WeebsOCR — Python untuk logika berat (API calls, file I/O), React untuk UI yang bisa dikustomisasi penuh sesuai Neobrutalism style.

---

## 3. Branding & Desain UI

### 3.1 Identitas

- **Nama Aplikasi:** LWNTL
- **Tagline:** "LN/WN Translator"
- **Gaya:** Neobrutalism — bold borders, hard drop shadows, flat colors, tipografi tebal
- **Tone:** Tajam, modern, no-nonsense — bukan "cantik" tapi "percaya diri"

### 3.2 Color System

```css
/* Core */
--color-primary:    #00F7FF;   /* cyan — aksen utama */
--color-black:      #111111;   /* border, shadow, teks */
--color-white:      #FFFFFF;   /* surface utama */
--color-bg:         #F8F3EA;   /* warm off-white — background halaman */

/* Semantic */
--color-yellow:     #FFEF33;   /* processing / warning */
--color-red:        #FF3C3C;   /* error / delete */
--color-green:      #28E272;   /* success / done */
--color-muted:      #666666;   /* teks sekunder */
--color-surface-2:  #F0F0F0;   /* nested surface */
```

### 3.3 Neobrutalism Rules — WAJIB DIIKUTI

Ini adalah aturan visual yang **tidak boleh dikompromikan:**

1. **Border:** Semua elemen interaktif (button, card, input, modal, panel) harus punya `border: 2.5px solid #111111`
2. **Shadow:** Semua card dan button punya `box-shadow: 4px 4px 0px #111111` — **bukan** blur shadow
3. **Radius:** `border-radius: 0` — sharp corners, tidak ada rounded
4. **Background:** Halaman menggunakan `--color-bg` (#F8F3EA), bukan putih atau hitam
5. **Typography:** Heading pakai **Space Grotesk Bold/Black**, body pakai **Inter Regular**
6. **Hover state button:** `transform: translate(2px, 2px)` + shadow mengecil jadi `2px 2px 0px`
7. **Active state button:** `transform: translate(4px, 4px)` + shadow hilang
8. **Topbar/Navbar:** Background `#111111`, teks dan aksen `--color-primary`
9. **Accent bar:** Setiap card punya strip warna primary `6px` di bagian atas
10. **Progress bar:** Wajib punya border hitam, fill warna primary

### 3.4 Tipografi

```css
/* Import di globals.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=Inter:wght@400;600;700&display=swap');

--font-display: 'Space Grotesk', sans-serif;
--font-body:    'Inter', sans-serif;
```

Scale:
- Display: Space Grotesk 900, 36px
- H1: Space Grotesk 700, 24px
- H2: Space Grotesk 700, 18px
- Body: Inter 400, 14px
- Caption: Inter 700, 11px, uppercase

### 3.5 Responsivitas

UI **wajib responsif** dari window 800×600 hingga fullscreen. Gunakan:
- CSS `flexbox` dan `grid` — tidak ada fixed pixel width kecuali untuk elemen kecil seperti badge
- Sidebar bisa di-collapse pada window sempit (< 960px)
- Split view chapter menggunakan `flex: 1 1 0` pada kedua panel agar auto-scale
- Topbar selalu full-width
- Card grid menggunakan `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`

---

## 4. Storage & Struktur Data

Semua data disimpan di folder lokal:
- Windows: `%APPDATA%/lwntl/`
- macOS: `~/Library/Application Support/lwntl/`
- Linux: `~/.config/lwntl/`

```
lwntl/
├── config.json
└── series/
    └── {seriesId}/
        ├── series.json
        └── chapters/
            └── {chapterId}/
                └── chapter.json
```

**`config.json`:**
```json
{
  "provider": "zhipuai",
  "model": "glm-5",
  "zhipuaiApiKey": "",
  "qwenApiKey": "",
  "temperature": 0.3,
  "maxTokensPerIteration": 16000,
  "theme": "light"
}
```

**`series.json`:**
```json
{
  "id": "uuid",
  "title": "Mushoku Tensei",
  "sourceLanguage": "japanese",
  "instructions": "Pertahankan honorifik -san, -kun, -chan...",
  "glossary": [
    {
      "id": "uuid",
      "sourceTerm": "剣聖",
      "translatedTerm": "Pendekar Pedang Suci",
      "notes": "Gelar tertinggi pendekar pedang",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

**`chapter.json`:**
```json
{
  "id": "uuid",
  "seriesId": "uuid",
  "chapterNumber": 42,
  "title": "The Return",
  "rawContent": "第四十二章\n...",
  "translatedContent": "## Bab 42\n\n...",
  "summary": "Rudeus kembali ke keluarganya setelah perjalanan panjang...",
  "status": "done",
  "glossaryUpdates": {
    "extractedAt": "2025-01-01T00:00:00Z",
    "entries": [
      { "sourceTerm": "剣聖", "translatedTerm": "Pendekar Pedang Suci", "notes": "", "isNew": false },
      { "sourceTerm": "魔法陣", "translatedTerm": "Lingkaran Sihir", "notes": "", "isNew": true }
    ]
  },
  "translationLog": {
    "iterations": 2,
    "totalTokens": 18400,
    "translatedAt": "2025-01-01T00:00:00Z"
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

**Status chapter:** `pending` | `processing` | `done` | `error`

---

## 5. Arsitektur & Navigasi

```
┌─────────────────────────────────────────┐
│           PyWebView Window              │
│  ┌─────────────────────────────────┐   │
│  │       React Frontend            │   │
│  │  Home → Series → Chapter        │   │
│  └──────────────┬──────────────────┘   │
│                 │ window.pywebview.api  │
│  ┌──────────────▼──────────────────┐   │
│  │       Python Backend            │   │
│  │  File I/O, GLM API, Translation │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Routing (React Router)

```
/                         → Home (daftar series)
/series/:id/settings      → Series Settings (prompt, model, glossary, chapter list)
/series/:id/chapter/:id   → Chapter Workspace
/settings                 → App Settings (API keys, tema)
```

---

## 6. Halaman & Fitur

### 6.1 Halaman Home (`/`)

- **Topbar:** Logo "LWNTL" (Space Grotesk Black, primary color) + tagline + tombol Settings (ikon gear)
- **Heading:** "KOLEKSI SERIES"
- **Tombol "+ TAMBAH SERIES"** (primary button, pojok kanan) → modal create
- **Grid card series** — `auto-fill, minmax(260px, 1fr)`

**Series Card:**
```
┌─────────────────────────────┐ ← border 2.5px + shadow 4px
│ ████ (accent bar primary)   │
│ Mushoku Tensei          [⋮] │ ← menu hover
│ Japanese  •  42 bab         │
│ ░░░░░░░░████████░░░░░░░░░░  │ ← progress bar
│ 28 / 42 selesai (67%)       │
└─────────────────────────────┘
```

Menu `⋮` (muncul saat hover): Edit Series, Pengaturan Series, Hapus Series

Klik card → `/series/:id/settings`

### 6.2 Halaman Series Settings (`/series/:id/settings`)

**Halaman utama manajemen series** — semua konfigurasi ada di sini. Layout 3 panel:

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOPBAR: ← | Judul Series — PENGATURAN | [ZhipuAI • GLM-5] [SIMPAN] │
├─────────────┬────────────────────────────────┬──────────────────────┤
│             │                                │                      │
│  DAFTAR BAB │  PROMPT & MODEL                │  GLOSSARY            │
│             │  ─────────────                 │                      │
│  [dot status│  Provider dropdown             │  [search bar]        │
│   per bab]  │  Model dropdown                │                      │
│             │  ─────────────                 │  [tabel CRUD]        │
│  [+ Tambah] │  System Prompt (textarea)      │  inline edit         │
│             │  Instruction Prompt (textarea) │                      │
│             │  ─────────────                 │  [+ ENTRI]           │
│             │  Max Tokens [slider] [nilai]   │                      │
│             │  Temperature [slider] [nilai]  │                      │
│             │  ─────────────                 │                      │
│             │  [SIMPAN PENGATURAN]           │                      │
└─────────────┴────────────────────────────────┴──────────────────────┘
```

**Panel Kiri — Daftar Bab:**
- List bab: nomor, judul, dot status berwarna (abu/kuning/hijau/merah)
- Tombol **"+ TAMBAH BAB"** → modal create (nomor, judul, paste raw content)
- Klik bab → navigasi ke `/series/:id/chapter/:id`
- Menu `⋮` per bab (hover): Edit, Hapus

**Panel Tengah — Prompt & Model:**

*Provider & Model (global, berlaku untuk semua series):*
- Dropdown **Provider**: ZhipuAI | Alibaba Cloud (Qwen)
- Dropdown **Model**: berubah sesuai provider (daftar lengkap di Section 8.1)
- Disimpan ke `config.json`

*System Prompt (global):*
- Textarea besar, pre-filled default system prompt — bisa diedit
- Indicator **"● BELUM DISIMPAN"** (kuning) muncul jika ada perubahan

*Instruction Prompt (per-series):*
- Textarea kedua, khusus series ini
- Placeholder: *"Pertahankan honorifik -san, -kun..."*
- Disimpan ke `series.json.instructions`

*Parameter:*
- Slider **Max Tokens** (1,000–128,000, default 16,000) + input angka manual di kanan
- Slider **Temperature** (0.0–1.0, step 0.1, default 0.3) + nilai di kanan
- Tombol **"SIMPAN PENGATURAN"** → simpan semua → toast success

**Panel Kanan — Glossary:**
- Search bar di atas tabel (filter real-time)
- Tabel: Istilah Asli | Terjemahan | Catatan | Aksi
- Klik baris → **inline edit** langsung di tabel (input muncul menggantikan teks)
- Tombol ✕ merah per baris → hapus dengan konfirmasi ringkas
- Tombol **"+ ENTRI"** → modal tambah entri baru
- `source_term` menyimpan teks bahasa sumber asli (kanji/hanzi/hangul)

### 6.3 Halaman Chapter (`/series/:id/chapter/:id`)

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR: ← | Series / Bab 42 | [TERJEMAHKAN] [REGENERATE]   │
├───────────────────────────┬──────────────────────────────────┤
│  RAW CONTENT              │  HASIL TERJEMAHAN          [DONE]│
│ ─────────────────────     │ ─────────────────────────────────│
│  (plain text, scroll)     │  (rendered Markdown)             │
│                           │                                  │
│                           │                                  │
│                           ├──────────────────────────────────┤
│                           │ ▶ LIHAT UPDATE GLOSSARY (n)      │
│                           │   [+ TAMBAHKAN SEMUA YANG BARU]  │
└───────────────────────────┴──────────────────────────────────┘
│ STATUS BAR: Processing... ████████░░ 60%                     │
└──────────────────────────────────────────────────────────────┘
```

- **Panel Kiri:** Raw content, read-only, font monospace, scroll
- **Panel Kanan:** Output terjemahan dirender `react-markdown` + `remark-gfm`
- Split view menggunakan **resizable divider** — user bisa drag tengah untuk adjust ratio
- **Tombol "TERJEMAHKAN":** Trigger proses, streaming output langsung ke panel kanan via SSE/polling
- **Tombol "REGENERATE":** Muncul hanya jika chapter sudah `done`
- **Progress bar** di status bar bawah selama proses berlangsung

**Glossary Update Panel (expandable, di bawah panel kanan):**
- Strip primary 4px di atas panel
- Default collapsed, expand saat diklik
- Saat expand: tabel Istilah Asli | Terjemahan | Catatan | Status
- Badge **"BARU"** (hijau) / **"ADA"** (abu) per baris
- Tombol **"+"** per baris "BARU" → tambah ke glossary utama
- Tombol **"+ TAMBAHKAN SEMUA YANG BARU"** → bulk insert

---

## 7. CRUD Lengkap

### 7.1 Series

| Operasi | Trigger | Aksi |
|---|---|---|
| Create | Tombol "+ TAMBAH SERIES" di Home | Modal: nama, bahasa sumber. Submit → buat folder + `series.json` |
| Read | Halaman Home load | Baca semua `series/*/series.json` → render card grid |
| Update | Menu ⋮ → "Edit Series" | Modal edit: nama, bahasa sumber. Submit → update `series.json` |
| Delete | Menu ⋮ → "Hapus Series" | Confirmation modal → hapus folder series + semua chapter |

### 7.2 Chapter

| Operasi | Trigger | Aksi |
|---|---|---|
| Create | Tombol "+ TAMBAH BAB" di Series page | Modal: nomor bab, judul (opsional), paste raw content. Submit → buat folder + `chapter.json` |
| Read | Series page load | Baca semua `series/{id}/chapters/*/chapter.json` → render list |
| Update | Menu ⋮ bab → "Edit" | Modal edit: nomor, judul, raw content. Submit → update `chapter.json` |
| Delete | Menu ⋮ bab → "Hapus" | Confirmation modal → hapus folder chapter |

### 7.3 Glossary Entry

| Operasi | Trigger | Aksi |
|---|---|---|
| Create (manual) | Tombol "+ ENTRI" di panel glossary | Modal: istilah asli, terjemahan, catatan. Submit → append ke `series.json.glossary[]` |
| Create (dari update panel) | Tombol "+" per baris / bulk | Insert entry ke `series.json.glossary[]` |
| Read | Series page / Chapter page load | Dari `series.json.glossary[]` |
| Update | Klik baris di tabel glossary | Inline edit atau modal edit |
| Delete | Ikon trash di baris glossary | Konfirmasi ringkas → remove dari array |

### 7.4 Instruksi Series

- Update saat user klik "SIMPAN INSTRUKSI" → write ke `series.json.instructions`

### 7.5 Delete Cascade & Confirmation Modal

```
Hapus SERIES → hapus semua chapter.json → hapus semua subfolder → hapus series.json → hapus folder series
Hapus CHAPTER → hapus chapter.json → hapus folder chapter
```

**Desain Confirmation Modal (komponen `DeleteConfirmModal`):**
```
┌──────────────────────────────────────────┐  ← border 2.5px + shadow 6px
│  🗑  HAPUS SERIES                         │
│                                          │
│  Kamu akan menghapus:                    │
│  ┌──────────────────────────────────┐   │
│  │  "Mushoku Tensei"                │   │  ← highlighted box
│  └──────────────────────────────────┘   │
│                                          │
│  Ini akan menghapus permanen:            │
│  • 42 chapter                           │
│  • Semua hasil terjemahan               │
│  • Semua glossary                       │
│                                          │
│  ⚠ TINDAKAN INI TIDAK BISA DIBATALKAN   │  ← merah
│                                          │
│    [ BATAL ]     [ HAPUS PERMANEN ]      │
│                   (disabled 1.5 detik)   │
└──────────────────────────────────────────┘
```

Spesifikasi modal:
- Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(2px)`
- Nama entitas dalam kotak border hitam + background primary transparan
- Tombol "HAPUS PERMANEN": background `--color-red`, border hitam, shadow 4px — **disabled 1.5 detik** setelah modal terbuka
- Tutup: Escape key atau klik backdrop

---

## 8. Multi-Provider AI System

### 8.1 Provider & Model Registry

Aplikasi mendukung dua provider. Konfigurasi tersimpan di `config.json`.

**ZhipuAI (Z.AI) via `zai-sdk`:**

| Model ID | Nama Display | Keterangan |
|---|---|---|
| `glm-5` | GLM-5 | Flagship, paling capable |
| `glm-4.7` | GLM-4.7 | Balance antara kualitas & biaya |
| `glm-4.7-flashx` | GLM-4.7-FlashX | Cepat, hemat |
| `glm-4.7-flash` | GLM-4.7-Flash | Gratis, cocok untuk testing |

**Alibaba Cloud / DashScope (OpenAI-compatible API):**

| Model ID | Nama Display | Keterangan |
|---|---|---|
| `qwen-plus` | Qwen3.5-Plus | Premium Qwen |
| `qwen-flash` | Qwen3.5-Flash | Hemat, cepat |
| `qwen3.6-plus` | Qwen3.6-Plus | Terbaru Qwen |
| `deepseek-v3` | DeepSeek V3.2 | Via Alibaba Cloud endpoint |

> **Catatan DeepSeek:** DeepSeek V3.2 diakses via Alibaba Cloud DashScope endpoint (bukan API DeepSeek langsung), sehingga memakai key yang sama dengan Qwen.

### 8.2 Provider Client

```python
from zai import ZaiClient
from openai import OpenAI  # Alibaba Cloud pakai OpenAI-compatible SDK

PROVIDERS = {
    "zhipuai": {
        "models": ["glm-5", "glm-4.7", "glm-4.7-flashx", "glm-4.7-flash"],
        "displayNames": {
            "glm-5": "GLM-5",
            "glm-4.7": "GLM-4.7",
            "glm-4.7-flashx": "GLM-4.7-FlashX",
            "glm-4.7-flash": "GLM-4.7-Flash (Free)",
        }
    },
    "qwen": {
        "models": ["qwen-plus", "qwen-flash", "qwen3.6-plus", "deepseek-v3"],
        "displayNames": {
            "qwen-plus": "Qwen3.5-Plus",
            "qwen-flash": "Qwen3.5-Flash",
            "qwen3.6-plus": "Qwen3.6-Plus",
            "deepseek-v3": "DeepSeek V3.2",
        },
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
}

class LLMClient:
    def __init__(self, config: dict):
        self.provider = config["provider"]
        self.model = config["model"]
        self.temperature = config.get("temperature", 0.3)
        self.max_tokens = config.get("maxTokensPerIteration", 16000)

        if self.provider == "zhipuai":
            self._client = ZaiClient(api_key=config["zhipuaiApiKey"])
        elif self.provider == "qwen":
            self._client = OpenAI(
                api_key=config["qwenApiKey"],
                base_url=PROVIDERS["qwen"]["baseUrl"]
            )

    def complete(self, messages: list, stream: bool = True, max_tokens: int = None):
        mt = max_tokens or self.max_tokens
        if self.provider == "zhipuai":
            return self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=mt,
                stream=stream
            )
        elif self.provider == "qwen":
            return self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=mt,
                stream=stream
            )
```

### 8.3 ZhipuAI Client

```python
from zai import ZaiClient

client = ZaiClient(api_key=api_key)

response = client.chat.completions.create(
    model="glm-5",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    temperature=0.3,
    max_tokens=16000,
    stream=True  # untuk streaming ke frontend
)
```

### 8.2 Parameter

| Parameter | Terjemahan | Extraction Pass |
|---|---|---|
| `temperature` | `0.3` | `0.1` |
| `max_tokens` | `16000` | `4000` |

### 8.3 Struktur Prompt

```
[SYSTEM]
Kamu adalah penerjemah profesional novel {source_language} ke Bahasa Indonesia.

Aturan wajib:
1. Terjemahkan secara alami dan mengalir, bukan harfiah
2. Pertahankan gaya bahasa sesuai konteks scene (aksi, romansa, komedi, dll)
3. Gunakan istilah dari Glossary secara konsisten — JANGAN mengarang terjemahan baru
4. Ikuti instruksi khusus yang diberikan
5. Format output dengan Markdown: paragraf dipisah baris kosong
6. Akhiri output dengan [SELESAI] jika terjemahan sudah lengkap
7. JANGAN tambahkan komentar atau penjelasan di luar teks terjemahan

Instruksi Khusus:
{series_instructions}

Glossary:
{glossary_formatted_as_table}

Konteks Bab Sebelumnya:
{rolling_summary_3_chapters}

[USER]
Terjemahkan bab berikut:

{raw_chapter_content}
```

### 8.4 Smart Iteration (Anti-Truncation)

```python
async def translate_with_iteration(raw_content: str, context: dict) -> str:
    full_translation = ""
    remaining = raw_content
    iteration = 0

    while remaining and iteration < 10:
        is_continuation = iteration > 0
        prompt = build_prompt(remaining, context, continuation=is_continuation)
        chunk = await call_glm_streaming(prompt)  # stream ke frontend real-time

        full_translation += chunk.replace("[SELESAI]", "")

        if chunk.strip().endswith("[SELESAI]") or is_sentence_complete(chunk):
            break

        remaining = extract_untranslated_portion(raw_content, full_translation)
        iteration += 1

    return full_translation
```

**Streaming ke frontend:** Setiap chunk yang masuk dari GLM langsung dikirim ke React via `window.evaluate_js()` agar muncul real-time di panel kanan.

### 8.5 Context Window 3-Layer

**Layer 1 — System Prompt:** Instruksi + glossary (statis per request)

**Layer 2 — Rolling Context:** Summary 3 bab terakhir yang sudah diterjemahkan. Summary dibuat otomatis setelah setiap bab selesai dengan GLM call terpisah (disimpan ke `chapter.json.summary`).

**Layer 3 — Smart Memory:** Setiap 10 bab, buat memory update — rangkuman kejadian penting dan karakter. Disimpan ke `series.json.memory[]`. Disertakan di prompt secara ringkas.

### 8.6 Extraction Pass (Glossary Auto-Extract)

Setelah terjemahan bab selesai, backend otomatis menjalankan extraction pass:

```python
extraction_prompt = """
Ekstrak semua nama karakter dan istilah khusus dari teks berikut.
Balas HANYA dengan JSON valid, tanpa penjelasan, tanpa markdown backtick.
Format: {"entries": [{"sourceTerm": "...", "translatedTerm": "...", "notes": "..."}]}
"""
```

Hasil disimpan ke `chapter.json.glossaryUpdates` dengan flag `isNew` berdasarkan perbandingan dengan `series.json.glossary`.

---

## 9. PyWebView API Bindings

```python
class API:
    # Config
    def get_config(self) -> dict
    def save_config(self, config: dict) -> bool

    # Series CRUD
    def get_all_series(self) -> list[dict]
    def create_series(self, title: str, language: str) -> dict
    def update_series(self, series_id: str, title: str, language: str) -> dict
    def get_series_delete_info(self, series_id: str) -> dict  # {"chapterCount": n}
    def delete_series(self, series_id: str) -> bool           # cascade

    # Chapter CRUD
    def get_chapters(self, series_id: str) -> list[dict]
    def create_chapter(self, series_id: str, number: int, title: str, raw_content: str) -> dict
    def update_chapter(self, series_id: str, chapter_id: str, number: int, title: str, raw_content: str) -> dict
    def get_chapter(self, series_id: str, chapter_id: str) -> dict
    def get_chapter_delete_info(self, series_id: str, chapter_id: str) -> dict
    def delete_chapter(self, series_id: str, chapter_id: str) -> bool  # cascade

    # Glossary CRUD
    def get_glossary(self, series_id: str) -> list[dict]
    def add_glossary_entry(self, series_id: str, source_term: str, translated_term: str, notes: str) -> dict
    def update_glossary_entry(self, series_id: str, entry_id: str, source_term: str, translated_term: str, notes: str) -> dict
    def delete_glossary_entry(self, series_id: str, entry_id: str) -> bool
    def confirm_glossary_updates(self, series_id: str, chapter_id: str, entry_ids: list[str]) -> bool
    def confirm_all_glossary_updates(self, series_id: str, chapter_id: str) -> bool

    # Instructions
    def save_instructions(self, series_id: str, instructions: str) -> bool

    # Translation
    def start_translation(self, series_id: str, chapter_id: str) -> None  # async, stream via evaluate_js
    def cancel_translation(self) -> bool

    # Export
    def export_chapter(self, series_id: str, chapter_id: str) -> bool  # save dialog .txt
    def export_series(self, series_id: str) -> bool                    # export semua bab selesai
```

**Streaming update ke frontend:**
```python
# Di dalam translation loop:
window.evaluate_js(f"window.onTranslationChunk({json.dumps({'chunk': text, 'iteration': i})})")
window.evaluate_js(f"window.onTranslationDone({json.dumps({'status': 'done'})})")
window.evaluate_js(f"window.onTranslationError({json.dumps({'error': str(e)})})")
```

---

## 10. Struktur Folder Proyek

```
lwntl/
├── main.py                      # PyWebView entry point
├── api.py                       # Class API (semua binding)
├── requirements.txt
│
├── core/
│   ├── llm_client.py            # Unified LLM client (ZhipuAI + Qwen)
│   ├── translator.py            # Smart iteration + streaming
│   ├── prompt_builder.py        # Build system & user prompt
│   ├── memory.py                # Rolling context + smart memory
│   ├── extractor.py             # Glossary extraction pass
│   └── storage/
│       ├── config.py            # config.json CRUD
│       ├── series.py            # series.json CRUD + cascade delete
│       └── chapters.py          # chapter.json CRUD + cascade delete
│
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── SeriesSettings.tsx        # NEW: 3-panel settings page
    │   │   └── ChapterWorkspace.tsx
    │   ├── components/
    │   │   ├── SeriesCard.tsx
    │   │   ├── ChapterList.tsx
    │   │   ├── GlossaryTable.tsx         # inline edit support
    │   │   ├── GlossaryUpdatePanel.tsx
    │   │   ├── PromptModelPanel.tsx      # NEW: provider+model+sliders
    │   │   ├── SplitView.tsx             # resizable divider
    │   │   ├── MarkdownRenderer.tsx
    │   │   ├── Toast.tsx                 # NEW: toast notification
    │   │   ├── ToastContainer.tsx        # NEW: stack manager
    │   │   ├── DeleteConfirmModal.tsx    # reusable
    │   │   ├── CreateSeriesModal.tsx
    │   │   ├── CreateChapterModal.tsx
    │   │   ├── EditSeriesModal.tsx
    │   │   ├── EditChapterModal.tsx
    │   │   ├── StatusBar.tsx
    │   │   ├── SkeletonCard.tsx          # NEW: loading skeleton
    │   │   └── AppSettingsModal.tsx      # API keys, tema
    │   ├── hooks/
    │   │   ├── useTranslation.ts
    │   │   ├── useSeries.ts
    │   │   └── useToast.ts               # NEW
    │   ├── store/
    │   │   └── appStore.ts              # Zustand: series, toasts, translation state
    │   └── styles/
    │       └── globals.css              # CSS variables + neobrutalism base + animations
    └── dist/                            # build output → dimuat PyWebView
```

---

## 11. Sistem Interaktivitas & Feedback UI

Aplikasi harus terasa **responsif dan hidup** — setiap aksi user wajib mendapat feedback visual. Tidak boleh ada aksi yang berjalan diam-diam tanpa indikator.

### 11.1 Toast Notification System

Komponen `Toast` muncul di pojok kanan bawah, auto-dismiss setelah 3 detik. Stack-able (bisa muncul bersamaan). Tiga varian, masing-masing punya accent bar warna di sisi kiri:

| Varian | Warna Accent | Ikon | Contoh Trigger |
|---|---|---|---|
| `success` | `--color-green` | ✓ | Instruksi disimpan, glossary ditambah, chapter dibuat |
| `error` | `--color-red` | ✗ | API error, file gagal disimpan |
| `info` | `--color-primary` | ℹ | Terjemahan dimulai, extraction berjalan |

```typescript
// Implementasi via Zustand store
interface Toast { id: string; type: 'success'|'error'|'info'; message: string }

const useToast = () => {
  const { addToast } = useAppStore()
  return {
    success: (msg: string) => addToast({ type: 'success', message: msg }),
    error:   (msg: string) => addToast({ type: 'error',   message: msg }),
    info:    (msg: string) => addToast({ type: 'info',    message: msg }),
  }
}
```

**Semua aksi berikut WAJIB memunculkan toast:**
- Simpan instruksi / pengaturan → success
- Tambah / edit / hapus series → success / error
- Tambah / edit / hapus chapter → success / error
- Tambah / hapus glossary entry → success
- Konfirmasi glossary updates → success "N istilah ditambahkan"
- Export chapter → success "File disimpan di [path]"
- Terjemahan dimulai → info
- Terjemahan selesai → success "Bab selesai diterjemahkan"
- Error API / timeout → error dengan pesan spesifik

### 11.2 Loading States

Setiap operasi async wajib punya loading state yang visible:

**Tombol Loading:**
- Saat tombol diklik dan proses berjalan → tombol disabled + teks ganti jadi "..." + ikon spinner kecil
- Contoh: "SIMPAN PENGATURAN" → "MENYIMPAN..."

**Skeleton Loading:**
- Saat halaman pertama load dan data sedang dibaca dari file → tampilkan skeleton cards (box abu-abu beranimasi pulse)
- Berlaku untuk: Home (series cards), Chapter list

**Translation Progress:**
- Progress bar di status bar bawah chapter workspace: `████████░░ 60%`
- Teks: `MENERJEMAHKAN...  •  Iterasi 2/3  •  [BATALKAN]`
- Update real-time via `window.onTranslationChunk`

**Extraction Progress:**
- Setelah terjemahan selesai, muncul indikator kecil di glossary update panel: `Mengekstrak istilah...`

### 11.3 Unsaved Changes Indicator

- Setiap textarea / input yang diubah tapi belum disimpan → muncul badge **"● BELUM DISIMPAN"** (kuning) di dekat tombol simpan
- Jika user navigasi away saat ada perubahan belum tersimpan → dialog konfirmasi: "Ada perubahan yang belum disimpan. Tinggalkan halaman?"

### 11.4 Inline Status Updates

- Dot status bab di daftar chapter **update real-time** selama terjemahan berlangsung (abu → kuning → hijau/merah) tanpa reload
- Series card di Home → progress bar update otomatis setelah selesai

### 11.5 Micro-interactions

- Semua tombol: `transform: translate(2px, 2px)` saat hover, `translate(4px, 4px)` saat active
- Card series: hover → shadow membesar jadi `6px 6px 0px`
- Menu `⋮`: fade-in saat hover, fade-out saat blur
- Modal open/close: slide-up animation `150ms ease`
- Toast: slide-in dari kanan `200ms`, slide-out ke kanan `200ms`
- Accordion glossary update panel: smooth `max-height` transition

### 11.6 Error Handling

- Semua `try-catch` di Python API → return `{"error": true, "message": "..."}` ke frontend
- Frontend selalu cek response error → tampilkan toast error dengan pesan dari Python
- Jika API key kosong → toast error "API key belum diisi. Buka Settings untuk mengisi."
- Jika file tidak bisa dibaca/ditulis → toast error "Gagal membaca file: [nama file]"

---



```txt
# requirements.txt
pywebview>=5.0
zai-sdk>=0.2.2
openai>=1.30          # untuk Alibaba Cloud Qwen (OpenAI-compatible)
pyinstaller>=6.0
```

```json
// package.json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "lucide-react": "latest",
    "zustand": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^3",
    "vite": "^5",
    "@types/react": "^18"
  }
}
```

**`config.json` awal (auto-create jika tidak ada):**
```json
{
  "provider": "zhipuai",
  "model": "glm-5",
  "zhipuaiApiKey": "",
  "qwenApiKey": "",
  "temperature": 0.3,
  "maxTokensPerIteration": 16000,
  "theme": "light"
}
```

---

## 13. Onboarding (First Run)

Jika `config.json` tidak ada atau semua API key kosong → tampilkan modal onboarding fullscreen:

```
┌────────────────────────────────────────────────┐
│           SELAMAT DATANG DI                    │
│         L W N T L                              │  ← Space Grotesk Black, primary
│      LN/WN Translator                          │
│                                                │
│  Pilih provider dan isi API Key untuk mulai:   │
│                                                │
│  [○ ZhipuAI (Z.AI)]  [○ Alibaba Cloud (Qwen)] │
│                                                │
│  API Key:                                      │
│  ┌──────────────────────────────────────────┐ │
│  │ ••••••••••••••••••••••••••••••••••••••   │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│              [ MULAI SEKARANG ]                │
└────────────────────────────────────────────────┘
```

Modal tidak bisa ditutup tanpa mengisi minimal satu API key.

---

## 14. Urutan Pengembangan (Build Order)

1. **Setup project** — struktur folder, PyWebView + Vite React, pastikan window terbuka
2. **CSS foundation** — `globals.css` semua CSS variables + animasi neobrutalism + Space Grotesk
3. **Storage layer** — `config.py`, `series.py`, `chapters.py` — CRUD + cascade delete
4. **LLM client** — `llm_client.py` unified ZhipuAI + Qwen, test 1 call tiap provider
5. **Toast system** — komponen Toast + Zustand store, test tampil/dismiss
6. **Translator + streaming** — smart iteration + `evaluate_js` streaming
7. **Prompt builder + memory** — rolling context + smart memory
8. **Extractor** — glossary extraction pass
9. **API bindings** — semua method di `api.py` dengan proper error handling
10. **Frontend: Home** — series card grid + skeleton + CRUD modals + toast
11. **Frontend: Series Settings** — 3 panel: chapter list, prompt/model panel, glossary inline edit
12. **Frontend: Chapter Workspace** — split view resizable + streaming render + progress + glossary update panel
13. **Polish** — onboarding, app settings modal, export, micro-interactions, responsivitas

---

## 15. Catatan Penting

- **Tidak ada database** — semua state dari JSON files
- **Tidak ada auth/login** — single-user, local app
- **Streaming + batch** wajib di `threading.Thread` — jangan block main thread PyWebView
- **Neobrutalism rules wajib diikuti** — Section 3.3, jangan improvisasi
- **Space Grotesk** untuk heading — bukan Inter, bukan system font
- **Semua modal React component** — tidak ada `window.alert()` atau `window.confirm()`
- **Toast wajib** untuk semua aksi — lihat Section 11.1
- **Provider model dropdown** di Series Settings bersifat global — perubahan berlaku untuk semua series
- **System prompt** juga global — satu template untuk semua series; instruction prompt yang per-series
- **Resizable split view** — drag event + simpan ratio di local state
- **Export** → save dialog → `.txt` atau `.md`
- Glossary dalam prompt: format markdown table `| 源術 | Seni Asal | Teknik langka |`
- Layout dan visual semua halaman sudah terdefinisi lengkap di Section 6 — gunakan ASCII mockup di sana sebagai panduan struktur

