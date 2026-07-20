---
description: AI model configuration is managed via fikr.one and OpenRouter — see fikr.one
---

# AI Model Configuration

Fikr Studio (Free tier) lets users pick models manually via `lib/ai-settings.ts`.

For **Plus/Pro managed AI**, model selection is controlled via OpenRouter Presets on the `fikr.one` backend — no Studio code change is needed.

→ Full workflow: `fikr.one/.agents/workflows/manage-ai-config.md`

## Fikr Studio local config

| Setting | File |
|---|---|
| Default model / provider | `lib/ai-settings.ts` |
| Endpoint management UI | `src/app/ModelsPanel.tsx` |
| Remote bridge | `src/tools/engine/remote_bridge.ts` |
