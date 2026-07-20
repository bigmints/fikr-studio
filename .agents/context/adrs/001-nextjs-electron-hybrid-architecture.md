# ADR 001 — Next.js + Electron Hybrid Architecture

**Date:** 2026-01-01
**Status:** Accepted
**Scope:** `fikr-studio/` Electron app

---

## Context

Fikr Studio needs to deliver a high-quality desktop app with:
- A rich, React-based UI (not Electron's native web limitations)
- Native OS capabilities: filesystem access, deep links, local AI execution
- A local-first data model (no cloud required for core usage)
- The ability to serve the same UI in a web context in the future

A pure web app can't access the filesystem. A pure native app would sacrifice ecosystem. A minimal Electron wrapper around raw HTML would be too brittle.

---

## Decision

Fikr Studio uses **Next.js (React) as the renderer inside Electron**. The two layers have distinct responsibilities and communicate exclusively via IPC.

**Next.js renderer layer:**
- Full React + TypeScript UI (App Router, but statically exported)
- `next build` → `next export` outputs `/out/` as static HTML/JS
- Electron loads: `mainWindow.loadFile("out/index.html")`
- No SSR — the app is client-side after export
- Tailwind CSS + Shadcn/UI (Radix) for styling
- Zustand for state management

**Electron main process:**
- Reads the Next.js static export — never runs a Node.js server
- Handles all filesystem operations (workspace reads/writes)
- Runs an internal HTTP/SSE server for MCP protocol and webhooks
- Handles deep links: `fikr-studio://auth`, `fikr-studio://mcp`
- Orchestrates local AI execution

**Preload script (`preload.js`):**
- Context-bridges safe IPC methods into `window.fikrStudio`
- Exposes channels: `read-file`, `write-file`, `install-mcp`, `execute-mcp`, `sync-data`

---

## Consequences

**Positive:**
- React ecosystem (hooks, Zustand, Shadcn) works fully inside Electron
- Clear layer separation: UI owns rendering, main process owns OS access
- Static export means Electron loads instantly (no dev-server dependency in prod)
- Web parity is achievable — `window.fikrStudio` can be polyfilled via HTTP

**Negative:**
- Every new OS capability requires a preload channel + IPC handler
- Static export means no Next.js server features (middleware, API routes) in the desktop app
- `next export` must be re-run for every UI change in production builds

**File map:**
```
app/           ← Next.js pages (App Router)
components/    ← React components
electron/
  main.js      ← Electron main process
  preload.js   ← Context bridge
out/           ← Static export (loaded by Electron)
```
