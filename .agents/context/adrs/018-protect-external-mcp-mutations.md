# ADR-018 — Protect External MCP Mutations

**Status:** `accepted`
**Date:** 2026-08-24
**Author:** electron-developer

---

## Context

Fikr's Electron main process persists MCP tool mutations directly, then sends a
live event to the React renderer. The renderer also persists its complete React
workspace whenever state changes. A rapid sequence of MCP writes can therefore
race with a renderer save based on state from immediately before the event,
overwriting a note or project that the main process already accepted.

This was reproduced with the live local MCP server by calling `create_note`,
`create_note_synthesized`, and `update_note` back to back. The next
`get_canvas` omitted one accepted note even though each tool returned success.

---

## Decision

The Electron main process keeps a bounded buffer of external workspace
operations and applies those operations to renderer save payloads until the
renderer demonstrably reflects each mutation.

**Chosen approach:**

- Record externally added, updated, and deleted notes plus newly created
  projects before notifying the renderer.
- Merge pending operations into full renderer workspace saves so stale React
  state cannot overwrite already accepted MCP changes.
- Remove an operation from the buffer only after a later renderer payload
  reflects the expected note/project state.
- Coalesce add-plus-update operations for the same note and cap the buffer at
  1,000 entries.

**Alternatives considered:**

- Delay external tool responses until React saves — rejected because the
  renderer is not the persistence authority and may be unavailable.
- Merge every `fromMcp` note from disk forever — rejected because it would
  resurrect notes a user intentionally deletes later.
- Add a workspace revision protocol immediately — deferred because it would
  require a broader persisted-schema and IPC migration.

---

## Consequences

**Positive:**

- Rapid MCP tool calls remain durable and immediately readable.
- Renderer saves still preserve chats, creations, and unrelated workspace
  edits.
- User-initiated deletion remains possible after the renderer has acknowledged
  the external mutation.

**Trade-offs / New constraints:**

- The in-memory operation buffer resets when Electron restarts; accepted data
  is already on disk, so the buffer only protects the live renderer race.
- Future external mutation types must be recorded in the same buffer before
  their renderer events are sent.

---

## Implementation Notes

**Files affected:**

- `lib/external-workspace-ops.js`
- `main.js`
- `tests/external-workspace-ops.test.js`

---

## References

- Related ADR: `008-production-renderer-and-relay-boundary.md`
- Related ADR: `016-agents-sdk-tool-runtime.md`
