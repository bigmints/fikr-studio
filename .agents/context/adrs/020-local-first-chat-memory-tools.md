# ADR-020 — Local-first Chat Memory Tools

**Status:** `accepted`
**Date:** 2026-08-26
**Author:** electron-developer

---

## Context

Fikr Chat already persists per-thread transcripts, but it cannot carry durable user preferences, identity, active projects, or goals between chats. Treating those facts as knowledge notes would blur provenance and citation semantics. Automatically extracting memories from every conversation would also turn model inference into persistent user data without a clear request.

---

## Decision

Store a bounded, workspace-level `chatMemories` collection separately from chat transcripts and knowledge notes. The Agents SDK accesses it through Fikr-owned recall, remember, and forget tools. Memory writes and deletions require explicit current-turn user intent; ordinary turns may recall relevant memories for continuity.

**Chosen approach:**

- Keep up to 200 concise memories in the local workspace JSON and browser fallback storage.
- Treat memories as user-provided continuity context, never as knowledge evidence or a citation source.
- Apply validated memory mutations in the renderer after the trusted Electron agent run succeeds.
- Execute explicit remember/list/forget commands through a deterministic Fikr-owned memory tool path so they also work on the legacy managed-AI route; BYOK/local agent runs retain the same Agents SDK tools for orchestration and ordinary recall.
- Reject likely secrets and credentials before persistence.
- Preserve local memories when the current cloud workspace schema omits the field.

**Alternatives considered:**

- Reuse knowledge notes — rejected because memories have different provenance, lifecycle, and citation semantics.
- Automatically extract memories from every chat — rejected because model inference must not silently become durable user data.
- Use provider-managed conversation state — rejected because Fikr must remain provider-neutral and own persistence.

---

## Consequences

**Positive:**

- Preferences and ongoing context can follow users across separate chats.
- Save, recall, forget, and clear-all behavior is tool-backed and testable.
- Knowledge citations remain limited to validated note retrieval.

**Trade-offs / New constraints:**

- The current server workspace schema does not sync memories between devices; local state is preserved when cloud responses omit it.
- Memory is intentionally explicit, so Fikr will not silently learn from ordinary conversation.
- Memory values are bounded and cannot contain likely secrets or full documents.

---

## Implementation Notes

**Files affected:**

- `lib/chat-memory.mjs`
- `lib/agent-runtime.js`
- `lib/fikr-chat.ts`
- `components/fikr-chat.tsx`
- `app/page.tsx`
- `lib/cloud-seed.js`

---

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
- OpenAI Agents SDK state guidance: `https://developers.openai.com/api/docs/guides/agents/running-agents`
