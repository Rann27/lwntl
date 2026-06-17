# LWNTL — LN/WN Translator

A desktop application for translating Light Novels and Web Novels using AI language models. Built with Python (PyWebView) and React.

> Designed for translators who want AI-assisted translation with glossary management, context memory, and multi-provider LLM support — all in a clean, offline-first desktop app.

---

## Features

- **Multi-provider LLM support** — ZhipuAI, Qwen, OpenAI, Google Gemini, Anthropic, xAI (Grok), Moonshot (Kimi), DeepSeek, Xiaomi MiMo, and OpenAI-compatible endpoints
- **Smart streaming translation** — real-time output with anti-truncation iteration
- **Glossary management** — per-series term dictionary, auto-extraction after each chapter, pre-filter injection, hover preview, import/export (JSON & CSV)
- **Context window** — rolling chapter summaries and memory blocks keep the AI consistent across chapters
- **Translation version history** — every retranslation archives the previous version; restore any past version with one click
- **Series grouping** — organize series into nested folder-like groups (up to 3 levels), with breadcrumb navigation, color accents, and aggregate progress stats
- **Drag-and-drop** — drag a series card into any group card (or onto a breadcrumb) to move it instantly
- **Batch translation** — translate all pending chapters in sequence, with auto-apply glossary and retry-failed support
- **Batch export** — export all Done chapters as a single merged `.docx` using a custom Word template for consistent formatting
- **Document import** — paste raw text, or import from `.pdf` or `.docx` files with multi-mode PDF parsing
- **Workers** — multiple concurrent translation workers, each pinnable to a separate provider/model
- **Dark mode** — warm dark palette, toggled from Settings and persisted
- **Bilingual UI** — full Bahasa Indonesia and English interface
- **Reasoning model support** — Thinking mode, configurable reasoning effort for DeepSeek and MiMo

---

## Requirements

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** *(first run only, to build the frontend)* — [nodejs.org](https://nodejs.org/)
- A valid API key from at least one supported LLM provider

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Rann27/lwntl.git
cd lwntl
```

### 2. Run the app

Double-click `run.bat` or run it from a terminal:

```bat
run.bat
```

**What `run.bat` does automatically:**
- Creates a Python virtual environment (`venv/`) if it doesn't exist
- Installs all Python dependencies from `requirements.txt`
- Builds the React frontend (`frontend/dist/`) if not already built
- Launches the application

> On first run this may take a few minutes. Subsequent runs start immediately.

### 3. Configure your API key

On first launch, the onboarding screen will prompt you to add an API key. You can also go to **Settings** (gear icon) at any time to add or change keys.

---

## Supported LLM Providers

| Provider | Models | Notes |
|---|---|---|
| ZhipuAI (Z.AI) | GLM-5, GLM-4.7, GLM-4.7-FlashX, GLM-4.7-Flash | Thinking toggle |
| Alibaba Cloud | Qwen3.5-Plus, Qwen3.5-Flash, DeepSeek V3.2 | Via DashScope |
| OpenAI | GPT-5.4, GPT-4.1, GPT-4o and variants | |
| Google Gemini | Gemini 2.5 Pro/Flash, 2.0 Flash, 3.x Preview | |
| Anthropic | Claude Opus/Sonnet/Haiku 4.x | |
| xAI (Grok) | Grok 4.20, Grok 4.1 Fast, Grok 3 | |
| Moonshot (Kimi) | Kimi K2.5, Moonshot v1 128k/32k/8k | |
| DeepSeek | DeepSeek-R1, DeepSeek-V3, DeepSeek-V2.5 | Thinking + Reasoning Effort |
| Xiaomi MiMo | MiMo-7B-RL | Thinking + Reasoning Effort |
| OpenAI Compatible | Any OpenAI-compatible endpoint | Custom base URL + model |

All providers support a **Custom Model** option — enter any model ID not listed above.

---

## Usage Guide

### Series Collection & Grouping

The home page shows your series in a grid. You can organize them into **Groups** (nested folders, up to 3 levels deep):

- Click **+ New Group** to create a root group
- Click into a group to drill down — breadcrumb navigation shows your current path
- Right-click (or use the group menu) to rename, change color, add a sub-group, or delete a group
- **Drag a series card** onto any group card to move it into that group
- **Drag onto a breadcrumb** item to move a series back up the hierarchy
- Use **Move to Group** in the series card menu to pick a target group from a tree picker

Groups show aggregate stats: number of series, chapters, and how many are translated.

### Creating a Series

1. Click **+ Add Series** on the home page (or inside a group — the series is automatically placed there)
2. Enter the series title, source language, and target language
3. Click Create — the series will appear in your collection

### Adding Chapters

1. Open a series → go to the **Chapters** tab (Series Settings)
2. Click **+ Add Chapter**
3. Enter a chapter number and optional title
4. **Paste raw text** or **import a file** (`.pdf`, `.docx`, or `.txt`)
5. Save

#### PDF Import Modes

| Mode | Description |
|---|---|
| Standard | Simple text extraction — fast, works for most PDFs |
| Bulk TXT | Treats each line as a separate sentence — good for dense layout |
| PDF Newline | Preserves original line breaks from the PDF |
| PDF Paragraph | Merges lines into natural paragraphs |
| Docx Import | Extract text from `.docx` files |

### Translating a Chapter

1. Open a chapter from the chapter list
2. The workspace shows: source text (left), translation output (center), settings (right)
3. Click **Translate** — the AI will stream the translation in real-time
4. When done, the chapter status changes to **Done** and the translation is saved automatically

> Translation also auto-generates a chapter summary (for context) and extracts glossary terms.

If the chapter already has a translation, you will be prompted to confirm before retranslating. The current version is archived in **version history** so you can always restore it.

### Translation Version History

Each chapter keeps a history of all past translations.

- Click **History** in the workspace to view past versions
- Click **Restore** on any version to make it current (the active translation is archived first)
- Versions are labelled `v1`, `v2`, etc. in chronological order

### Glossary

The glossary is per-series and stores source terms with their translations and notes.

- **Auto-extract**: After each translation, the AI suggests new terms found in the chapter. Review them in the **Update Glossary** panel.
- **Pre-filter**: Only glossary terms that appear in the current chapter are injected into the prompt (toggle in Series Settings).
- **Manual add**: Go to the series **Glossary** tab to add, edit, or delete entries.
- **Import/Export**: Load or save as `.json` or `.csv`.

### Batch Translation

On the chapter list, click **Select** to choose chapters, then **Translate** to queue them sequentially. Or use **Translate All** to process every Pending chapter at once.

- **Retry Failed**: After a batch run, any failed chapters can be retried with one click.
- **Auto-apply Glossary**: New terms extracted during a batch are automatically added to the glossary.

### Exporting Translations

- **Single chapter**: Open a chapter → click **Export** → saves as `.docx` (with optional Word template)
- **Quick export**: In the chapter list, click the download icon next to any Done chapter
- **Batch export**: Series Settings → **Export All** → all Done chapters merged into one `.docx`, each chapter starting on a new page

#### Custom Word Template

Place a file named `TemplateNew.docx` in any of these locations:
- `%APPDATA%\lwntl\TemplateNew.docx` *(preferred — survives app updates)*
- The app root directory (next to `main.py`)
- Same directory as the compiled `.exe`

When a template is found, exports use its styles, fonts, margins, and page setup. If no template is found, a plain document is used as fallback.

### Workers

Workers are independent translation slots. Each worker can be assigned a separate provider, model, max tokens, and temperature.

- Configure workers in **Series Settings → Prompt & Model** 
- Assign a worker to a series so it always uses that worker's configuration
- Multiple workers allow translating chapters from different series in parallel

### System Prompt & Instructions

- **System Prompt** — the global translation instruction template. Supports variables: `{source_language}`, `{target_language}`, `{title}`. Defaults to a sensible translation prompt if left empty.
- **Instruction Prompt** — per-series additional instructions (e.g., "keep honorifics -san, -kun intact"). Appended to the system prompt at translation time.

---

## Settings

Accessible via the gear icon (top-right).

| Setting | Description |
|---|---|
| API Keys | Add keys for each provider. Only providers with a key can be selected. |
| Theme | Light / Dark mode. Persisted across sessions. |
| App Language | Bahasa Indonesia or English. |
| Provider & Model | Select active provider and model per worker. |
| Max Tokens | Maximum output tokens per translation iteration (default: 16,000). |
| Temperature | Sampling temperature (default: 0.3 — lower = more consistent). |
| Thinking Mode | Enable extended reasoning for DeepSeek, MiMo, and ZhipuAI models. |
| Reasoning Effort | Low / Medium / High reasoning depth for DeepSeek and MiMo. |
| Source / Target Languages | Manage the language list available in series creation. |
| Glossary Pre-filter | Only inject terms present in the chapter being translated. |

---

## Manual Setup (Without `run.bat`)

```bash
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Build the frontend
cd frontend
npm install
npm run build
cd ..

# 4. Run the app
python main.py
```

---

## Project Structure

```
lwntl/
├── main.py                  # PyWebView entry point
├── api.py                   # Python methods exposed to the frontend
├── run.bat                  # One-click launcher (Windows)
├── build.bat                # Build script for PyInstaller
├── lwntl.spec               # PyInstaller spec
├── requirements.txt
├── core/
│   ├── llm_client.py        # Unified multi-provider LLM client
│   ├── translator.py        # Translation logic with streaming + iteration
│   ├── extractor.py         # Glossary auto-extraction
│   ├── context_window.py    # Rolling summary + memory context builder
│   ├── prompt_builder.py    # System/user prompt construction
│   ├── exporter.py          # .docx export (single + batch + template)
│   ├── document_parser.py   # PDF / DOCX import with multi-mode parsing
│   ├── worker_manager.py    # Concurrent translation workers
│   └── storage/
│       ├── config.py        # App config (API keys, settings)
│       ├── series.py        # Series CRUD
│       ├── chapters.py      # Chapter CRUD + version history
│       ├── glossary.py      # Glossary CRUD
│       └── groups.py        # Group CRUD (nested, up to 3 levels)
└── frontend/                # React 19 + TypeScript + Tailwind (Vite)
    └── src/
        ├── pages/           # HomePage, SeriesSettingsPage, ChapterWorkspacePage, SettingsPage
        ├── components/      # SeriesCard, GroupCard, GroupFormModal, GroupPickerModal, ...
        ├── i18n/            # Bilingual translations (id, en)
        ├── api.ts           # TypeScript wrappers for all Python API calls
        └── types.ts         # Shared TypeScript types
```

Data is stored in `%APPDATA%\lwntl\` (Windows) — no database, plain JSON files.

---

## Changelog

### v1.6.0
- **Series Grouping** — nested groups (up to 3 levels), breadcrumb navigation, color accents, aggregate stats
- **Drag-and-drop** — drag series cards into group cards or onto breadcrumbs
- **Move to Group** — picker modal for moving a series to any group in the tree
- **Batch Export** — export all Done chapters as a single merged `.docx` with page breaks
- **Custom Word Template** — `TemplateNew.docx` support for preserving styles/fonts/margins

### v1.5.0
- **Xiaomi MiMo** provider — thinking mode + configurable reasoning effort

### v1.4.0
- **DeepSeek** — configurable reasoning effort (Low / Medium / High)
- Bug fixes: onboarding display, batch archive race, memory compaction, cancel race condition

### v1.3.0
- **DeepSeek** provider added
- **ZhipuAI** thinking mode toggle
- **Glossary pre-filter** — only inject terms present in the current chapter
- Consistency fixes across the translation pipeline

### v1.2.0
- **Concurrent translation guard** — prevents double-translating a chapter
- **Retry failed** chapters after batch translation
- **Retranslate confirmation** modal before overwriting existing translations
- **Translation version history** — archive and restore past versions

### v1.1.0
- **Batch chapter selection** — select and translate/delete multiple chapters at once
- **Auto-apply glossary** — new terms added automatically after batch translation
- **Editable raw content** — edit source text inline in the workspace
- **Copy / Export clean text** — copy or export the translation without markup
- **Inline glossary form** — add glossary entries without leaving the workspace

---

## Troubleshooting

**DevTools window opens on startup**
→ Set `debug=False` in `main.py` and restart.

**"Built frontend not found" error**
→ Run `run.bat` or manually run `npm run build` in the `frontend/` directory.

**Translation hangs for a long time**
→ Some providers (especially reasoning models) have high latency. Try a faster variant (e.g., GLM-4.7-Flash, DeepSeek-V3) or reduce Reasoning Effort.

**API key not accepted**
→ Make sure the key is saved (click **Save** in Settings) and the correct provider is selected.

**Batch export produces a plain document (no template styles)**
→ Place `TemplateNew.docx` in `%APPDATA%\lwntl\` or next to `main.py`. The app logs which path it found (or didn't find) on export.

**Antivirus flags the compiled `.exe`**
→ Known false positive with PyInstaller. The source code is fully open — build from source if preferred.

---

## License

MIT — free to use, modify, and distribute.

---

*Built with [PyWebView](https://pywebview.flowrl.com/), [React](https://react.dev/), and a lot of patience for slow LLM APIs.*
