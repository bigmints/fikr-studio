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
- Widget JSX uses 100% inline CSS — no Tailwind classes inside widget scope
- Cloud sync goes through authenticated fikr.one APIs; never ship Firebase Admin credentials

## Knowledge

All knowledge in `.agents/context/knowledge/`:
- `architecture.md`, `ai_pipeline.md`, `mcp_architecture.md`
- `integrations.md`, `ui_patterns.md`, `workspace_views.md`
- `integration_user_guides.md` (17 integrations detail)

## Git Hooks

```bash
bash .agents/skills/heartbeat/setup-hooks.sh
```
