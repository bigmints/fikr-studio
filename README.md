# FikrPad

**A design experiment in spatial, AI-augmented thinking.**

Part of the Fikr family. A spatial research tool that reads what you write and enriches it with AI — no prompting, no chat. Just capture your thinking and let the structure emerge. Desktop companion for Fikr Voice Notes.

*This application is a fork of [Nodepad](https://github.com/mskayyali/nodepad) by Saleh Kayyali, modified and rebranded for the Fikr ecosystem.*

---

Most AI tools are built around a chat interface: you ask, it answers, you ask again. The interaction is sequential, conversational, and optimised for producing output. FikrPad is built around a different premise: that thinking is spatial and associative, and that AI is most useful when it works quietly in the background rather than at the centre of attention.

You add notes. The AI classifies them, finds connections between them, surfaces what you haven't said yet, and occasionally synthesises an emergent insight from the whole canvas. You stay in control of the space. The AI earns its place by being genuinely useful rather than prominent.

---

## How it works

Notes are typed into the input bar and placed onto a spatial canvas. Each note is automatically classified into one of 14 types — claim, question, idea, task, entity, quote, reference, definition, opinion, reflection, narrative, comparison, thesis, general — and enriched with a short annotation that adds something the note doesn't already say.

Connections between notes are inferred from content. When you hover a connection indicator, unrelated notes dim. When enough notes accumulate, a synthesis emerges — a single sentence that bridges the tensions across the canvas. You can solidify it into a thesis note or dismiss it.

Three views: **tiling** (spatial BSP grid), **kanban** (grouped by type), **graph** (force-directed, centrality-radial).

---

## Setup

**Requirements**: macOS (for the desktop app) or a modern browser, plus an API key from one of the supported providers.

```bash
git clone https://github.com/Bigmints-com/fikrpad.git
cd fikrpad
npm install

# Run in development (browser)
npm run dev

# Build the macOS DMG application
APPLE_KEYCHAIN_PROFILE="notarytool-profile" APPLE_TEAM_ID="FBG8NKYPUJ" npm run electron:build
```

**Add your API key**: click the menu icon (top-left) → Settings → choose your provider → paste your key. The key is stored locally and goes directly to the AI provider.

**Enable web grounding** (optional): toggle "Web grounding" in Settings to let the AI cite real sources for claims, questions, and references. Supported on OpenRouter `:online` models and OpenAI search-preview models.

---

## Providers & Models

Select provider and model from the sidebar Settings panel. Each provider remembers its key independently.

### OpenRouter *(default)*
Access to all major models through a single key. Create a free account at [openrouter.ai](https://openrouter.ai).
- `openai/gpt-4o` (Default)
- `anthropic/claude-sonnet-4-5`
- `google/gemini-2.5-pro`
- `deepseek/deepseek-chat`
- `nvidia/nemotron-3-nano-30b-a3b:free`

### OpenAI *(direct)*
Use your OpenAI API key directly.
- `gpt-4o`
- `gpt-4o-mini`
- `o4-mini`

### Custom Local Providers
FikrPad also supports Custom LLM Providers (e.g. self-hosted models or custom inferencing endpoints). You can configure a Custom Base URL and API key from the settings.

---

## Keyboard shortcuts

| | |
|---|---|
| `Enter` | Add note |
| `⌘K` | Command palette (views, navigation, export) |
| `⌘Z` | Undo |
| `Escape` | Deselect / close panels |

Double-click any note to edit. Click the type label to reclassify manually.

---

## Data

Everything lives locally. No account, no server, no database.

- Notes are persisted to `localStorage` under `fikrpad-projects`
- A silent rolling backup is written on every change to `fikrpad-backup`
- Export to `.md` or `.fikrpad` (versioned JSON) via `⌘K`
- Import `.fikrpad` files via the sidebar

---

## Tech

Next.js · React 19 · TypeScript · Tailwind CSS v4 · Electron · D3.js · Framer Motion

---

## License

This project is licensed under the [MIT License](LICENSE).
Based on the open-source project Nodepad by [Saleh Kayyali](https://github.com/mskayyali).
