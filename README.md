# LWNTL — LN/WN Translator

A desktop application for translating Light Novels and Web Novels using AI language models. Built with Python (PyWebView) and React.

> Designed for translators who want AI-assisted translation with glossary management, context memory, and multi-provider LLM support — all in a clean, offline-first desktop app.

---

## Features

- **Multi-provider LLM support** — ZhipuAI, Qwen, OpenAI, Google Gemini, Anthropic, xAI (Grok), Moonshot (Kimi)
- **Smart streaming translation** — real-time output with anti-truncation iteration
- **Glossary management** — per-series term dictionary, auto-extraction after each chapter, hover preview, import/export (JSON & CSV)
- **Context window** — rolling chapter summaries and memory blocks keep the AI consistent across chapters
- **Chapter search** — hybrid search by chapter number or title
- **Dark mode** — warm dark palette, toggled from Settings and persisted
- **Export** — translated chapters to `.docx` (single chapter or full series)
- **Batch translation** — translate multiple pending chapters in sequence
- **Per-series system prompt** — customize the AI's translation style per series

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

| Provider | Models | Docs |
|---|---|---|
| ZhipuAI (Z.AI) | GLM-5, GLM-4.7, GLM-4.7-FlashX, GLM-4.7-Flash | [bigmodel.cn](https://bigmodel.cn/dev/api/normal-model/glm-4) |
| Alibaba Cloud | Qwen3.5-Plus, Qwen3.5-Flash, DeepSeek V3.2 | [alibabacloud.com](https://www.alibabacloud.com/help/en/model-studio/getting-started/models) |
| OpenAI | GPT-5.4, GPT-4.1, GPT-4o and variants | [platform.openai.com](https://platform.openai.com/docs/models) |
| Google Gemini | Gemini 2.5 Pro/Flash, 2.0 Flash, 3.x Preview | [ai.google.dev](https://ai.google.dev/gemini-api/docs/models) |
| Anthropic | Claude Opus/Sonnet/Haiku 4.x | [docs.anthropic.com](https://docs.anthropic.com/en/docs/about-claude/models) |
| xAI (Grok) | Grok 4.20, Grok 4.1 Fast, Grok 3 | [docs.x.ai](https://docs.x.ai/docs/models) |
| Moonshot (Kimi) | Kimi K2.5, Moonshot v1 128k/32k/8k | [platform.moonshot.cn](https://platform.moonshot.cn/docs/api/chat) |

All providers support a **Custom Model** option — enter any model ID not listed above.

---

## Usage Guide

### Creating a Series

1. Click **+ Add Series** on the home page
2. Enter the series title, source language, and target language
3. Click Create — the series will appear in your collection

### Adding Chapters

1. Open a series → go to the **Chapters** tab
2. Click **+ Add Chapter**
3. Paste the raw source text and give it a chapter number and title
4. Save

### Translating a Chapter

1. Open a chapter from the chapter list
2. The workspace shows: source text (left), translation output (center), settings (right)
3. Click **Translate** — the AI will stream the translation in real-time
4. When done, the chapter status changes to **Done** and the translation is saved automatically

> Translation also auto-generates a chapter summary (for context) and extracts glossary terms.

### Glossary

The glossary is per-series and stores source terms with their translations and notes.

- **Auto-extract**: After each translation, the AI suggests new terms found in the chapter. Review them in the **Update Glossary** panel at the bottom of the workspace.
- **Manual add**: Go to the series **Glossary** tab to add, edit, or delete entries.
- **Import**: Click **Import** to load a `.json` or `.csv` glossary file.
- **Export**: Click **Export** to save the glossary as `.json` or `.csv` via a native save dialog.
- **Hover preview**: Hover over any glossary row to see the full entry details.

Glossary terms are automatically injected into the system prompt during translation to keep terminology consistent.

### System Prompt & Instructions

- **System Prompt** — the global translation instruction template. Supports variables: `{source_language}`, `{target_language}`, `{title}`. Defaults to a sensible translation prompt if left empty.
- **Instruction Prompt** — per-series additional instructions (e.g., "keep honorifics -san, -kun intact"). Appended to the system prompt at translation time.

### Batch Translation

On the chapter list page, select multiple chapters and click **Translate All** to queue them for sequential translation. Only chapters with **Pending** status will be processed.

### Exporting Translations

- **Single chapter**: Open a chapter → click **Export** → saves as `.docx`
- **Full series**: Series settings → **Export Series** → choose a folder → all **Done** chapters exported as separate `.docx` files

---

## Settings

Accessible via the gear icon (top-right) or the `/settings` route.

| Setting | Description |
|---|---|
| API Keys | Add keys for each provider. Only providers with a key can be selected. |
| Theme | Light / Dark mode. Persisted across sessions. |
| Provider & Model | Select active provider and model in the workspace panel. |
| Max Tokens | Maximum output tokens per translation iteration (default: 16,000). |
| Temperature | Sampling temperature (default: 0.3 — lower = more consistent). |
| Source / Target Languages | Manage the language list available in series creation. |

---

## Manual Setup (Without `run.bat`)

If you prefer to set up manually:

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

## Project Structure (Brief)

```
lwntl/
├── main.py              # PyWebView entry point
├── api.py               # Python methods exposed to the frontend
├── run.bat              # One-click launcher (Windows)
├── requirements.txt
├── core/
│   ├── llm_client.py    # Unified multi-provider LLM client
│   ├── translator.py    # Translation logic with streaming + iteration
│   ├── extractor.py     # Glossary auto-extraction
│   ├── context_window.py # Rolling summary + memory context builder
│   ├── prompt_builder.py # System/user prompt construction
│   ├── exporter.py      # .docx export
│   └── storage/         # File-based JSON storage (config, series, chapters)
└── frontend/            # React 19 + TypeScript + Tailwind (Vite)
```

Data is stored in `%APPDATA%\lwntl\` (Windows) — no database, plain JSON files.

---

## Troubleshooting

**DevTools window opens on startup**
→ This means `debug=True` is set in `main.py`. Set it to `False` and restart.

**"Built frontend not found" error**
→ Run `run.bat` or manually run `npm run build` in the `frontend/` directory.

**Translation hangs for a long time**
→ Some providers (especially heavier models) have high latency. This is normal — the app will display output once the server responds. Try a faster model variant (e.g., GLM-4.7-Flash instead of GLM-4.7).

**API key not accepted**
→ Make sure the key is saved (click **Save** in Settings) and the correct provider is selected in the workspace panel.

**Antivirus flags the app**
→ Not applicable for this version (Python script, not compiled). If you compile to `.exe` yourself, this may occur — it's a known false positive with PyInstaller.

---

## License

MIT — free to use, modify, and distribute.

---

*Built with [PyWebView](https://pywebview.flowrl.com/), [React](https://react.dev/), and a lot of patience for slow LLM APIs.*
