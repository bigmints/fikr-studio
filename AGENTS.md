---
project: fikr-studio
role: electron-developer
authority: CANONICAL
---

# Fikr Studio — Agent Entry Point

> Read this file at the start of every session before taking any action.

## Project Overview

**Fikr Studio** is an Electron desktop app — a local-first AI workspace with integrated LLM inference, widgets/spaces, and MCP server connectivity.

| | |
|---|---|
| **Stack** | Electron + React + TypeScript |
| **Framework** | Next.js static export |
| **Styling** | Tailwind CSS v4 + Shadcn/UI |
| **State** | React state |
| **Local data** | Versioned JSON workspace |
| **Local search** | Deterministic lexical relevance vectors |
| **Auth** | Shared fikr.one SSO |

---

## Session Lifecycle

```
START → .agents/workflows/bootstrap.md → [WORK] → .agents/workflows/process.md → END
```

**Quick commands:**
```bash
.agents/skills/heartbeat/pulse.sh "<task>"
.agents/skills/task-manager/manage.sh list
.agents/skills/validate-code/validate.sh   # npm run lint + tsc --noEmit
```

---

## Completion Gates

1. `npm run lint` → **0 errors**
2. `npx tsc --noEmit` → **0 errors**
3. No debug logs, no hardcoded paths committed

---

## Skills

| Skill | Path | Purpose |
|---|---|---|
| heartbeat | `.agents/skills/heartbeat/pulse.sh` | Liveness timestamp |
| task-manager | `.agents/skills/task-manager/manage.sh` | Task lifecycle |
| validate-code | `.agents/skills/validate-code/validate.sh` | Lint + type check |
| auto-context | `.agents/skills/auto-context/update-context.sh` | Worklog updates |
| compress-worklog | `.agents/skills/compress-worklog/compress.sh` | Compress worklog |
| minions | `.agents/skills/minions/scripts/minions` | YAML queue runner |

---

## Workflows

| Workflow | Purpose |
|---|---|
| `process.md` | Canonical agent process |
| `bootstrap.md` | Session start |
| `release.md` | Build, sign, notarize Electron DMG |
| `deploy.md` | Build + publish OTA to GitHub |
| `manage-ai-config.md` | Update OpenRouter presets |
| `log.md` | Log summary to Fikr Studio |

---

## Architecture

```
app/                     ← Next.js renderer
components/              ← React UI
lib/                     ← Renderer logic and authenticated cloud client
main.js                  ← Electron main process and local MCP server
preload.js               ← Narrow renderer IPC bridge
```

**Key rules:**
- CSS vars use oklch CHANNELS ONLY (L C H) — not full `oklch()` values
- Use shadcn/Radix components for dropdowns, date pickers, and comparable interactive controls; never expose browser-native control chrome.
- Widget JSX uses 100% inline CSS — no Tailwind classes inside widget scope
- Cloud sync goes through authenticated fikr.one APIs; never ship Firebase Admin credentials

## Agent connection boundary

- Local MCP is free and local-only. Fikr Studio must be open. Use it for reads,
  searches, creates, updates, deletes, and canvas tools from an AI client on the
  same computer.
- Remote or background note delivery requires Plus or Pro and must use a
  SaveADay Messenger Hook created at `https://www.fikr.one/dashboard/settings`.
- Messenger is one-way note ingestion. It is not remote MCP and does not expose
  read, search, edit, delete, or canvas tools.
- Do not request a Relay API Key for remote note delivery. Do not expose or
  tunnel the local MCP endpoint to the internet.
- When the user supplies **Copy instructions for agent** text, treat the URL,
  source key, and signing secret as server-only secrets. Never commit or log
  them. The hook already selects the Fikr user and project.

Human and agent instructions are in `docs/messenger-notes.md`.

## Knowledge

All knowledge in `.agents/context/knowledge/`:
- `architecture.md`, `ai_pipeline.md`, `mcp_architecture.md`
- `integrations.md`, `ui_patterns.md`, `workspace_views.md`
- `integration_user_guides.md` (17 integrations detail)

## Git Hooks

```bash
bash .agents/skills/heartbeat/setup-hooks.sh
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
