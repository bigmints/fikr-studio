# ADR 003 — MCP Two-Tier Architecture (Local + Cloud Relay)

**Date:** 2026-01-01
**Status:** Accepted
**Scope:** `fikr-studio/` + `fikr-studio-mcp/` + `fikr.one/`

---

## Context

Fikr Studio needed to expose its canvas to AI IDEs (Cursor, Windsurf, Claude Desktop, GitHub Copilot) via the Model Context Protocol (MCP). Two constraints made this hard:
1. AI IDEs run in strict sandboxes — they often can't find `npx` in `$PATH`
2. MCP requires `stdio` transport, but Fikr Studio uses SSE internally
3. Some users want MCP to work even when their laptop is closed (cloud-only)

---

## Decision

A **two-tier MCP architecture** separated by subscription tier, with a standalone NPM proxy package bridging the stdio ↔ SSE gap.

### Tier 1 — Free (Local, requires Studio open)

```
AI IDE  →  stdio  →  fikr-studio-mcp (npx)  →  HTTP/SSE  →  localhost:3025/sse  →  Fikr Studio
```

- Endpoint: `http://localhost:3025/sse`
- No auth (loopback only)
- `install-mcp` IPC handler runs `which npx` and writes the absolute path into the generated config — bypasses IDE sandbox PATH issues

### Tier 2 — Plus/Pro (Cloud, Studio not required)

```
AI IDE  →  SSE  →  fikr.one/api/mcp/sse  →  Firestore  →  Fikr Studio (if open) OR direct Firestore
```

- Endpoint: `https://fikr.one/api/mcp/sse`
- Auth: `Bearer fkr_<48 hex>` relay API key
- Plan check at the SSE gate — `403` if Free tier
- Direct Firestore read/write for read ops (no Studio needed)
- Queue-based relay (`/api/mcp/relay`) for operations requiring local AI enrichment

### The Proxy Package (`fikr-studio-mcp`)

- Lives at `fikr-studio-mcp/` in the monorepo, published to NPM
- AI IDEs spawn: `npx -y fikr-studio-mcp@latest <endpoint-url>`
- Receives `stdio` JSON-RPC from IDE → forwards to SSE endpoint → pipes response back
- Published with `npm publish --access public` (uses automation token, never committed)
- All generated configs use `@latest` — new proxy versions auto-picked up without Studio update

**PATH fix:** `install-mcp` IPC handler executes `which npx`, gets the absolute path (e.g. `/opt/homebrew/bin/npx`), and writes it directly into the `mcp_config.json`. Completely bypasses IDE sandbox restrictions.

---

## Consequences

**Positive:**
- Free users get full local MCP without any cloud dependency
- Plus/Pro users get 24/7 MCP access without keeping their laptop open
- Proxy decouples IDE sandbox limitations from Studio's SSE architecture
- `@latest` flag means proxy updates ship without a Studio release

**Negative:**
- Two relay routes to maintain (`/api/mcp/relay` and `/api/mcp/sse`)
- NPM publish is a manual step — must bump version in `fikr-studio-mcp/package.json` before publishing
- Security: relay API keys (`fkr_*`) must never be committed; rotation via UI deletes all open sessions

**Key files:**
- `fikr-studio-mcp/cli.js` — proxy implementation
- `fikr.one/src/app/api/mcp/sse/route.ts` — cloud MCP server
- `fikr.one/src/app/api/mcp/keys/route.ts` — key provisioning and rotation
- `fikr.one/src/lib/mcp-tools.ts` — shared tool definitions for cloud execution
