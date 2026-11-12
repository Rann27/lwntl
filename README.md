# LWNTL — LN/WN Translator

A desktop application for translating Light Novels and Web Novels with AI language models. Built with Python (PyWebView) and React.

> Designed for translators who want AI-assisted translation that stays consistent across a whole volume — locked glossaries, context memory, built-in translation rules per language pair, a no-token QA pass, and an optional review agent — in an offline-first desktop app.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Updating](#updating)
- [Supported LLM Providers](#supported-llm-providers)
  - [Live model lists](#live-model-lists)
  - [ChatGPT plan (no API key)](#chatgpt-plan-no-api-key)
- [Usage Guide](#usage-guide)
  - [Series, groups and profiles](#series-groups-and-profiles)
  - [Adding chapters](#adding-chapters)
  - [Translating](#translating)
  - [Translation options](#translation-options)
  - [Glossary](#glossary)
  - [Prompts and presets](#prompts-and-presets)
  - [QA Scan](#qa-scan)
  - [Agent Run (review)](#agent-run-review)
  - [Version history and backups](#version-history-and-backups)
  - [Exporting](#exporting)
- [Recommended pipeline](#recommended-pipeline)
- [Settings](#settings)
- [Data and privacy](#data-and-privacy)
- [Manual Setup (without `run.bat`)](#manual-setup-without-runbat)
- [Building the executable](#building-the-executable)
- [Project Structure](#project-structure)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

**Translation**
- **Streaming translation** — single chapters or batches, several workers in parallel, each pinned to its own provider and model
- **Context that carries across chapters** — rolling chapter summaries, long-term memory, and *Look Up* (the previous chapters' finished text)
- **Revision Pass**, **AutoFix CJK** and **Iteration Lock** per series
- **Illustration placeholders** survive translation and export; an image folder links them to real images

**Consistency**
- **Per-series glossary** locked into every prompt, with a pre-filter that recognises terms through furigana, width and variant-kanji differences, name separators, honorifics, partial names and inflections
- **Terminology pre-pass** builds the glossary from the raw text before chapter 1
- **Duplicate guards and aliases** — a term already in the glossary is never added again under another spelling
- **Glossary audit and review** — usage counts, conflicts, duplicates, and one-click fixes

**Prompts**
- **Built-in prompt presets** for JP/CN/KR → EN/ID, EN → ID and ID → EN; duplicate any preset to edit it
- **Editable helper prompts** for the revision pass, AutoFix CJK and the pre-pass

**Quality**
- **QA Scan** — deterministic checks with no AI and no tokens, aware of the source language, with one-click safe fixes
- **Agent Run** — an optional tool-using reviewer that repairs flagged chapters, with a whole-series backup before every run

**Providers**
- ZhipuAI, Qwen, OpenAI, Gemini, Anthropic, xAI, Moonshot, DeepSeek, Xiaomi MiMo, OpenRouter, Experiential Labs, UncensoredLLM, any OpenAI-compatible endpoint — and your **ChatGPT plan** without an API key
- **Model lists fetched from each provider**, so new models appear without an app update

**App**
- Series groups (nested folders), multiple profiles, `.docx` export with a Word template, light/dark theme, Bahasa Indonesia and English UI

---

## Requirements

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** *(to build the frontend)* — [nodejs.org](https://nodejs.org/)
- An API key from at least one supported provider, **or** a ChatGPT plan (Go, Plus, Pro, Business)

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

`run.bat` creates the virtual environment (`venv/`), installs `requirements.txt`, builds the frontend into `frontend/dist/` if it is not built yet, and launches the app. The first run takes a few minutes.

### 3. Connect a provider

Open **Settings → Provider & API**. Enter an API key for any provider, or press **Continue with ChatGPT** to use your ChatGPT plan. Then pick a model per worker in **Settings → Worker**.

---

## Updating

```bash
git pull
venv\Scripts\pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
```

`run.bat` only builds the frontend when `frontend/dist/` is missing, so after pulling an update rebuild it as above (or delete `frontend/dist/` and run `run.bat`). Otherwise the new screens will not appear.

---

## Supported LLM Providers

| Provider | Key | Notes |
|---|---|---|
| ZhipuAI (Z.AI) | API key | Thinking toggle, reasoning effort |
| Alibaba Cloud (Qwen) | API key | DashScope international; thinking toggle |
| OpenAI | API key | Reasoning effort (temperature is not sent to reasoning models) |
| Google Gemini | API key | Thinking level; safety filter can be switched off |
| Anthropic (Claude) | API key | Effort (temperature is not sent to Claude 5.x) |
| xAI (Grok) | API key | Reasoning effort |
| Moonshot (Kimi) | API key | International or China platform; effort and thinking |
| DeepSeek | API key(s) | Several keys, one per worker; thinking + reasoning effort |
| Xiaomi MiMo | API key | Thinking + reasoning effort |
| OpenRouter | API key | Whole OpenRouter catalog; reasoning, routing and data-policy options per model |
| Experiential Labs | API key | OpenAI-compatible AI gateway |
| UncensoredLLM | API key | OpenAI-compatible, abliterated open-weight models |
| ChatGPT (plan) | **none** | Sign in with your ChatGPT account — see below |
| OpenAI Compatible | optional | Any OpenAI-compatible endpoint (Ollama, LM Studio, LocalAI, …) with a custom base URL |

Each worker card shows exactly which parameters will be sent for the chosen model (*Dikirim*), and why some are left out.

### Live model lists

Model lists come from the providers themselves: the `/models` endpoint of OpenAI-style APIs, the Gemini and Anthropic model APIs, the OpenRouter catalog, and the ChatGPT plan catalog. Lists are cached for a day; the ⟳ button next to a worker's model fetches them again. The picker shows each model's name, ID and limits where the provider gives them, and labels where the list came from:

| Label | Meaning |
|---|---|
| `LIVE` | just fetched from the provider |
| `CACHE` | fetched within the last day |
| `BAWAAN` | LWNTL's built-in list — no key yet, or the provider did not answer |

Any model ID can still be typed by hand (**Custom…**).

### ChatGPT plan (no API key)

LWNTL can run translations on your ChatGPT plan instead of API credit, through OpenAI's official [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) for open-source, locally hosted apps.

1. **Settings → Provider & API → Continue with ChatGPT** opens the sign-in in your browser.
2. After signing in, the card shows your account and **Using ChatGPT plan · Manage usage**.
3. Pick a ChatGPT model for a worker in **Settings → Worker**.

Details:
- Requests use the Responses API. Temperature and output limits are not sent (the plan does not accept them).
- Reasoning cannot be switched off on plan models; **LOW** is the lightest level. Levels follow each model's own catalog (some reach ULTRA, others stop at MAX).
- Usage counts against your ChatGPT plan; manage it at [chatgpt.com/settings/usage](https://chatgpt.com/settings/usage).
- Tokens stay on your computer (`%APPDATA%\lwntl\chatgpt_auth.json`) and are refreshed automatically. **Putuskan** disconnects the account.

---

## Usage Guide

### Series, groups and profiles

- **Series** — click **+ Add Series**, enter a title, source language and target language. Source languages include Japanese, Chinese, Korean, English and Indonesian.
- **Groups** — nested folders up to three levels. Drag a series card onto a group card (or a breadcrumb) to move it; groups show aggregate progress.
- **Profiles** — separate workspaces with their own series, prompt templates and settings (for example one per language pair). Switch them from the top bar.

### Adding chapters

Open a series and click **+ Add Chapter**. Paste raw text, or import a file:

| Source | Notes |
|---|---|
| `.txt` | Plain text |
| `.docx` | Text and embedded illustrations |
| `.pdf` | Modes: Standard, Bulk TXT, PDF Newline, PDF Paragraph; PDF pre-preview with margin detection |
| Bulk `.md` | Many Markdown chapters at once, ordered by filename |

**Image Source** assigns a folder of images to the series, so `Image PlaceHolder: file.jpg` lines in text imports are linked to the real images for preview and export.

### Translating

- **Single chapter** — open it and press **Translate**; output streams live and is saved when done.
- **Batch** — **Translate All** processes every pending chapter in order, or **Select** a set of chapters. New glossary terms are applied after each chapter, so the next one already uses them. **Retry failed** re-runs chapters that errored.
- **Workers** — each worker is a slot with its own provider and model; raise **Max Concurrent** to run several jobs on one worker. A series prefers its chosen worker and falls back to any free one.

After each chapter LWNTL writes a short summary for the rolling memory and reads the glossary table the model appends. When a model writes no table, a fallback extraction reads the whole chapter and keeps only renderings the text actually uses.

### Translation options

Set per series in **Prompt & Model**:

| Option | What it does |
|---|---|
| **Look Up** | Adds the finished text of the last *N* chapters to the prompt, so voice and register carry across chapter boundaries (capped in size). |
| **Revision Pass** | A second call that revises the draft for prose quality; accepted only when structure checks pass (paragraphs, dialogue, scene markers, placeholders). |
| **AutoFix CJK** | Replaces Japanese/Chinese/Korean words left in the output, one occurrence at a time. |
| **Iteration Lock** | One generation per chapter (default). Turn off to allow continuation passes for very long chapters. |
| **Glossary pre-filter** | Only glossary entries that occur in the chapter go into the prompt (Settings). |
| **Max tokens / Temperature / Context** | Output budget, sampling temperature (where the model accepts it), and the context window used for the budget indicator. |

### Glossary

The glossary is per series and **non-negotiable** in the prompt: each entry has a source term, a translation, notes (gender, address form, speech pattern) and optional **aliases** (other source spellings, e.g. a kana form).

- **Pre-Pass Terms** scans the raw text of all chapters and proposes terms before you translate, so chapter 1 already uses the final renderings. Review and apply the proposals.
- **Auto-apply** adds new terms from each chapter's table. A term already in the glossary under any spelling (furigana, width, variant kanji, separators, honorific form) is never added twice; a new spelling of a name or proper term with the same rendering becomes an alias; a part of a name with a different reading is refused.
- **Pre-filter matching** recognises a term through furigana, half-width katakana, variant kanji, `・`/`＝` separators, brackets, honorifics, inflected verbs, and a character called only by surname or given name — so a term that is in the chapter is not dropped from the prompt.
- **All Terms** lists what every chapter's table proposed. Only renderings that actually appear in a chapter's text count as inconsistencies; table-only differences are marked **HANYA TABEL**.
- **Glossary audit** (QA Scan → Glosarium) shows how often each entry occurs in the source and the translation, and flags entries that are unused, single-chapter, conflicting with a related name, duplicated, or sharing a rendering. **Review** walks through them: pick the canonical rendering (rewritten everywhere), merge a duplicate into an alias, mark as correct, or delete.
- Import and export as `.json` (aliases included) or `.csv`.

### Prompts and presets

- **System prompt** — the translation rules. **Instructions** — optional extra rules, per series or per profile. Both support `{source_language}`, `{target_language}` and `{title}`.
- **Built-in presets** exist for JP→EN, JP→ID, CN→EN, CN→ID, KR→EN, KR→ID, EN→ID and ID→EN. They are read-only and update with the app. Open **PRESET**, pick one and press **DUPLIKAT** to get an editable copy, shared by every profile.
- A series or a profile can point at a preset instead of holding its own text. The prompt actually used is resolved in this order:
  1. the series' own text
  2. the series' preset
  3. the profile template text
  4. the profile preset
  5. the built-in for the series' language pair — only when nothing above *and* no instructions are set
- **Helper prompts** (Prompt Templates): the guidance for the revision pass, AutoFix CJK and the pre-pass can be edited per profile; the output format they must follow is fixed.
- Built-in presets are generated from a Cowork prompt package with `python tools/build_presets.py "<package folder>"`.

### QA Scan

**QA Scan** checks every translated chapter without AI and without tokens.

- **Per chapter** — residual source characters and punctuation, romanization (macrons, Pinyin tone marks, Korean diacritics), markup, quotes, scene-marker count and form, missing placeholders, dialogue coverage, sections and gaps much shorter than their source (omissions), duplicate paragraphs, truncation, glossary terms whose locked rendering never appears, glossary variants used in the text, and source-specific leftovers (untranslated address terms and interjections, romanized Korean, untranslated English/Indonesian sentences). English targets also get gender-vs-glossary, acronym and US/UK spelling checks; Indonesian targets get standard spelling and pronoun-register checks.
- **Per volume** — name variants, spelling consistency, quote style, opener and length outliers, diction density, phrase frequency, glossary health.
- **Auto-fix** — mechanical findings (typography, source marks, romanization, bold, italics, quotes, spelling, acronyms) are fixed with **PERBAIKI SEMUA AUTO-FIX**, or per category in **Perbaikan Aman**. Previous versions go to each chapter's history.
- **Tinjau & perbaiki** opens a chapter with its findings next to the source lines; edit a paragraph, or ask the model for a suggested fix.
- **Ganti Nama** renames a rendering everywhere it can re-enter the model's context (text, summaries, memory, glossary).
- Findings are shown in the app language (Indonesian or English).

### Agent Run (review)

**Run Agent** reviews chapters that are already translated; it never translates. Translate with **Translate All** first.

- **Findings only** (recommended) — the agent works only on chapters the QA detectors flag. **Full cross-check** — every chapter, plus a source check at the riskiest spots (short sections, the chapter opening and ending).
- Safe fixes run first, so the agent spends no tokens on them. A final **volume pass** aligns names and terms across chapters.
- The agent edits one paragraph at a time through guarded tools (no source characters, no lost placeholders, no destructive rewrites). A chapter whose high-severity findings increase is rolled back automatically.
- Needs a model with tool calling; others fall back to a single-shot repair.

### Version history and backups

- Every retranslation, safe fix, agent edit, merge or rename archives the previous text in the chapter's **version history**; restore any version from the chapter.
- **Agent Run** also saves a **whole-series snapshot** (all translated chapters and the glossary) before it starts. **Run Agent → Backup → Pulihkan** restores a whole run in one step; restoring the glossary is optional. The last ten snapshots are kept.

### Exporting

- **Single chapter** — **Export** in the chapter workspace, or the download icon in the chapter list.
- **Whole series** — **Export All** merges every done chapter into one `.docx`, each chapter on a new page, illustrations embedded.
- **Word template** — place `TemplateNew.docx` in `%APPDATA%\lwntl\` (preferred), the app folder, or next to the `.exe`; exports use its styles, fonts, margins and page setup.

---

## Recommended pipeline

1. Create the series and import chapters; assign an image folder if the raw has illustrations.
2. Choose the built-in preset for the language pair (or let the series use it automatically), and turn on **Look Up** — optionally **Revision Pass** and **AutoFix CJK**.
3. **Pre-Pass Terms** → review the glossary (genders, address forms, names).
4. **Translate All**.
5. **QA Scan** → **Perbaiki semua auto-fix** → review the remaining findings and the glossary audit.
6. Optionally **Run Agent** (*Findings only*) — a backup is taken first.
7. **Export All**.

---

## Settings

Open with the gear icon. Settings are split into tabs; the last tab you used is remembered.

| Tab | Contents |
|---|---|
| **Umum / General** | App language, light/dark theme, source and target language lists |
| **Provider & API** | One card per provider: API key, provider options (thinking, reasoning effort, region, routing, safety filter), and the ChatGPT sign-in. **Test provider aktif** checks the active provider. |
| **Worker** | Worker cards: provider, model (live list), DeepSeek key, max concurrent jobs, and the parameters that will be sent |

Per-series options (worker, prompt, translation options) live in the series' **Prompt & Model** panel. Prompt templates per profile live in **Prompt Templates**.

---

## Data and privacy

- All data is stored locally in `%APPDATA%\lwntl\` as plain JSON — no database, no server. Each profile has its own folder.
- API keys are kept in the local config. ChatGPT tokens are kept separately in `chatgpt_auth.json` and are never written to config or logs.
- Agent backups live next to each series (`agent-backups/`); glossary entries removed by the audit are backed up next to the series as well.

---

## Manual Setup (without `run.bat`)

```bash
# 1. Create and activate a virtual environment
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

## Building the executable

```bat
build.bat
```

Builds a portable folder with PyInstaller (`lwntl.spec`) into `dist\LWNTL\`. The built frontend and the built-in prompt presets are bundled.

---

## Project Structure

```
lwntl/
├── main.py                  # PyWebView entry point
├── api.py                   # Python methods exposed to the frontend
├── run.bat / build.bat      # Launcher and PyInstaller build (Windows)
├── lwntl.spec               # PyInstaller spec
├── requirements.txt
├── tools/
│   └── build_presets.py     # Generates core/presets from a Cowork prompt package
├── core/
│   ├── llm_client.py        # Multi-provider client and per-model request rules
│   ├── model_catalog.py     # Live model lists per provider (cached)
│   ├── chatgpt_auth.py      # Sign in with ChatGPT (PKCE, tokens, plan catalog)
│   ├── openrouter.py        # OpenRouter catalog and per-model parameters
│   ├── translator.py        # Translation pipeline: streaming, glossary table, revision, AutoFix
│   ├── worker_manager.py    # Workers and concurrent jobs
│   ├── prompt_builder.py    # System prompt resolution, glossary pre-filter, user prompt
│   ├── prompt_presets.py    # Built-in and user prompt presets
│   ├── presets/             # Built-in system prompts per language pair (+ index.json)
│   ├── task_prompts.py      # Editable helper prompts (revision, AutoFix, pre-pass)
│   ├── context_window.py    # Rolling summaries and long-term memory
│   ├── lookup.py            # Look Up: previous chapters' text in context
│   ├── reviser.py           # Revision pass with structure checks
│   ├── cjk_autofix.py       # AutoFix CJK
│   ├── placeholder.py       # Illustration placeholder preservation
│   ├── image_sync.py        # Image folder ↔ placeholders
│   ├── term_match.py        # Shared term matching (pre-filter, duplicates, audit, QA)
│   ├── glossary_guard.py    # Name-part conflict checks
│   ├── glossary_audit.py    # Glossary audit and review actions
│   ├── terminology.py       # Terminology pre-pass
│   ├── extractor.py         # Glossary table parsing and fallback extraction
│   ├── chapter_check.py     # Per-chapter QA detectors (source-aware)
│   ├── qa_scan.py           # Volume QA, safe-fix runs, rename
│   ├── qa_fix.py            # Safe mechanical fixes
│   ├── qa_chapter.py        # Chapter review: findings in context, suggested fixes
│   ├── qa_i18n.py           # Indonesian wording for QA findings
│   ├── agent.py             # Agent Run (review → repair → volume pass)
│   ├── agent_tools.py       # Guarded tools the agent edits with
│   ├── agent_backup.py      # Whole-series snapshots and restore
│   ├── exporter.py          # .docx export (single, batch, template)
│   ├── document_parser.py   # PDF / DOCX / Markdown import
│   └── storage/
│       ├── config.py        # App config, profiles
│       ├── series.py        # Series and glossary (aliases, duplicate guards)
│       ├── chapters.py      # Chapters and version history
│       ├── groups.py        # Nested groups
│       └── templates.py     # Prompt templates per profile
└── frontend/                # React 19 + TypeScript + Tailwind 4 (Vite)
    └── src/
        ├── pages/           # Home, Series Settings, Chapter Workspace, Settings
        ├── components/      # Panels and modals (QA report, glossary review, agent run, presets, …)
        ├── hooks/           # Translation, batch, model catalog
        ├── i18n/            # Bahasa Indonesia and English
        ├── styles/          # Theme tokens (light and dark)
        ├── api.ts           # Wrappers for the Python API
        └── types.ts         # Shared types and provider registry
```

---

## Changelog

### 2026-11 — consistency, quality and providers
- **Built-in prompt presets** for eight language pairs, read-only and duplicable; series/profile preset selection with automatic fallback to the pair's built-in
- **Glossary term matching** shared by the pre-filter, duplicate checks, audit and QA (furigana, width, variant kanji, separators, brackets, honorifics, name parts, inflections); **aliases**; duplicate merging in the glossary review
- **Fallback glossary extraction** reads the whole chapter and keeps only renderings the text uses; **All Terms** counts only real inconsistencies
- **Source-aware QA** for Chinese, Korean, English and Indonesian sources; glossary variants in the text; English gender, acronym and US/UK checks; **fix-all** for safe fixes; findings in Indonesian
- **Agent Run** reviews translated chapters only, with a whole-series **backup and one-step restore**
- **Live model lists** from each provider; **ChatGPT plan** via Sign in with ChatGPT; **Experiential Labs** and **UncensoredLLM** providers
- **Settings** in tabs with a responsive grid; calmer **dark mode** palette
- English and Indonesian added as source languages

### 2026-10 — review and context
- **Agent Run** (translate → review → repair loop), **deterministic QA** with safe fixes and chapter review, **Revision Pass**, **Look Up**, glossary guard and audit, **OpenRouter**, editable helper prompts

### Earlier
- Terminology pre-pass, image folder for text imports, long single-call generations, Gemini safety filter switch, AutoFix CJK, illustration preservation, multiple DeepSeek keys, Iteration Lock, Bulk MD import, multi-profile support, CJK detector, profile templates, PDF pre-preview

### v1.6.0
- Series grouping, drag-and-drop, Move to Group, batch export, custom Word template

### v1.5.0
- Xiaomi MiMo provider

### v1.4.0
- DeepSeek reasoning effort; onboarding, batch archive, memory and cancel fixes

### v1.3.0
- DeepSeek provider, ZhipuAI thinking toggle, glossary pre-filter

### v1.2.0
- Concurrent translation guard, retry failed, retranslate confirmation, version history

### v1.1.0
- Batch selection, auto-apply glossary, editable raw content, clean copy/export, inline glossary form

---

## Troubleshooting

**New screens don't appear after updating**
→ The frontend was not rebuilt. Run `npm run build` in `frontend/`, or delete `frontend/dist/` and run `run.bat`.

**"Built frontend not found" error**
→ Run `run.bat`, or `npm install && npm run build` in `frontend/`.

**A worker's model list says `BAWAAN`**
→ The provider has no key yet or did not answer; the built-in list is shown. Check the key and press ⟳. The hint under the picker shows the provider's error.

**ChatGPT sign-in fails**
→ Press **Continue with ChatGPT** again — an authorization code can only be used once. The page in the browser shows the actual result. If the plan's usage limit is reached, manage it at [chatgpt.com/settings/usage](https://chatgpt.com/settings/usage).

**The model often writes no glossary table**
→ LWNTL falls back to an extraction call and keeps only renderings found in the text (look for `No table found` in the logs). A model that follows the output contract more strictly avoids the extra call.

**Gemini refuses some chapters**
→ Turn the Gemini **Safety Filter** off in Settings → Provider & API.

**Translation takes a long time**
→ Reasoning models are slow at high effort. Lower the reasoning effort, or use a faster model.

**Antivirus flags the compiled `.exe`**
→ Known false positive with PyInstaller. Build from source if preferred.

---

## License

MIT — free to use, modify, and distribute.

---

*Built with [PyWebView](https://pywebview.flowrl.com/), [React](https://react.dev/), and a lot of patience for slow LLM APIs.*
