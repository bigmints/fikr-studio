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
| **Bundler** | Vite |
| **Styling** | Tailwind CSS v3 + Shadcn/UI |
| **State** | Zustand |
| **DB** | SQLite (better-sqlite3) |
| **Local LLM** | @mlc-ai/web-llm (WebGPU) |
| **Auth** | Shared fikr.one SSO |

---

## Session Lifecycle

```
START → .agents/workflows/_shared/bootstrap.md → [WORK] → .agents/workflows/_shared/maintain-context.md → END
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
src/
  lib/fikr.ts            ← Unified API bridge (window.fikr / HTTP REST)
  tools/engine/
    remote_bridge.ts     ← IPC proxy for LLM requests
  app/                   ← React pages
electron/
  ipc/handlers.ts        ← All IPC handlers
```

**Key rules:**
- CSS vars use oklch CHANNELS ONLY (L C H) — not full `oklch()` values
- Widget JSX uses 100% inline CSS — no Tailwind classes inside widget scope
- All IPC requests go through `net:fetchStream` to avoid CORS

## Knowledge

All knowledge in `.agents/context/knowledge/`:
- `architecture.md`, `ai_pipeline.md`, `mcp_architecture.md`
- `integrations.md`, `ui_patterns.md`, `workspace_views.md`
- `integration_user_guides.md` (17 integrations detail)

## Git Hooks

```bash
bash .agents/skills/heartbeat/setup-hooks.sh
```
