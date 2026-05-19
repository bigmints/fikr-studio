# ADR 002 — Local-First Data Model (SQLite + workspace.json)

**Date:** 2026-01-01
**Status:** Accepted
**Scope:** `fikr-studio/` Electron app

---

## Context

Fikr Studio's core promise is that user data belongs to the user. Cloud sync is optional (Plus/Pro). The persistence model must work fully offline, be fast, and be portable enough for users to back up and export their data.

An early approach used a flat `workspace.json` file. As the data model grew (notes, projects, embeddings, synthesis), SQLite became necessary for queries and scale.

---

## Decision

**Primary persistence:** SQLite via `better-sqlite3` in the Electron main process.

- Database location: `~/.fikr-studio/fikr.db`
- All reads/writes go through IPC handlers in `electron/ipc/handlers.ts`
- The renderer (React) never touches SQLite directly — it calls `window.fikrStudio.*` IPC methods

**Data model:**
- Projects contain Blocks (notes) and GhostNotes (AI-synthesized insights)
- Blocks store: `id`, `text`, `annotation`, `category`, `contentType`, `embedding` (384-dim float array), `createdAt`, `updatedAt`
- `embedding` is stored as a JSON array for local cosine-similarity search

**Export format:** `.fikrdata` — portable JSON dump of a project or individual notes, enabling offline backup and migration.

**Sync (Plus/Pro only):** Firestore is the cloud mirror. `sync.push` / `sync.pull` via IPC handlers. Local SQLite is always the source of truth — cloud sync is additive, not authoritative.

**Auto-save:** The renderer calls `ipc.syncWorkspace()` on structural changes. The main process debounces writes to prevent disk thrashing.

---

## Consequences

**Positive:**
- No network required for core usage — fully offline
- SQLite is fast enough for semantic search on thousands of notes (BM25 keyword index)
- `.fikrdata` export makes data truly portable
- Firestore sync is opt-in and non-blocking

**Negative:**
- Embeddings stored as JSON in SQLite (not a native vector type) — cosine similarity runs in JS, not SQL
- IPC overhead for every read — can feel slow if handlers are not batched
- Schema migrations must be versioned carefully via `better-sqlite3` migration scripts

**Key rule:** The renderer **never** imports `better-sqlite3` directly. All DB access is via IPC. This keeps the renderer context-safe for the web parity target.
