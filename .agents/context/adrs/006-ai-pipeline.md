# ADR 006 — AI Pipeline (Local Embeddings + Note Synthesis + Ghost Notes)

**Date:** 2026-01-01
**Status:** Superseded by ADR 007
**Scope:** `fikr-studio/` Electron app

---

## Context

Fikr Studio needed AI capabilities (semantic search, note classification, insight generation) without forcing cloud dependency for Free users. Cloud vector databases (Pinecone, Weaviate) require API keys, add latency, and expose user data. A local-first AI pipeline was needed.

The original implementation used `@xenova/transformers` for local embeddings. This has since been replaced with a BM25-style keyword index due to `onnxruntime-node` compatibility issues with newer versions of `@xenova/transformers` in Node.js ESM.

---

## Decision

A three-stage AI pipeline handles all note intelligence:

### Stage 1 — Embeddings (Local, BM25 keyword index)

- **Current:** Pure-JS BM25-style keyword scoring in `electron/ipc/handlers.ts`
- **Previous (deprecated):** `@xenova/transformers` `Xenova/all-MiniLM-L6-v2` — removed due to `onnxruntime-node` v1.26 API mismatch (`cpuData` vs `data` Tensor) with `@xenova/transformers ≥ 2.17` in Node.js ESM
- Semantic search runs in-process, results in < 10ms
- Embeddings stored in SQLite as JSON arrays (if re-enabled later)

### Stage 2 — Note Synthesis (Classification + Annotation)

Every note goes through a synthesis pipeline before it's considered "enriched":

1. **Classification:** `contentType` assigned — `idea | task | opinion | claim | quote | question | reference | definition | reflection | narrative | comparison | general`
2. **Categorization:** Short domain tag — `Engineering`, `Design`, `Product`, etc.
3. **Annotation:** AI-written 2-3 sentence insight/summary

**Two synthesis paths:**
- **Standard:** UI calls local or cloud LLM to enrich the note — note shows `isEnriching: true` during processing
- **Pre-synthesis (MCP):** External agents (Claude, Cursor) call `create_note_synthesized` — the agent pre-classifies before writing to Studio, bypassing the `isEnriching` state entirely. This is the preferred path for agent-to-Studio writes.

### Stage 3 — Ghost Notes (Emergent Insights)

- A Cloud LLM (OpenAI/Anthropic-compatible or local via LM Studio / WebLLM) scans note clusters
- Generates a Ghost Note — a synthesized insight summarizing themes across multiple notes
- Ghost Notes render distinctively in the Canvas (visually differentiated from user notes)
- Users can "merge" Ghost Notes into permanent, user-owned notes

### Local LLM (WebLLM)

- `@mlc-ai/web-llm` with `MLCEngine` runs in the renderer via WebGPU
- IndexedDB cache persists downloaded model weights between sessions
- LRU eviction (`MAX_LOADED_MODELS = 2`) prevents VRAM exhaustion
- Used for Ghost Note generation and Studio Mode content drafting when no remote API is configured

---

## Consequences

**Positive:**
- Free users get semantic search and synthesis without any API key
- Pre-synthesis MCP path enables instant, `isEnriching`-free note creation from agents
- WebLLM provides offline AI for Plus/Pro features when network is unavailable

**Negative:**
- Xenova embeddings were removed — BM25 is less semantically rich than true vector search
- Ghost Note generation requires an active LLM (local WebLLM or configured remote)
- WebLLM model downloads are large (1–4 GB) — first-use experience requires clear UX messaging

**Invariant:** `create_note_synthesized` is always preferred over `create_note` for agent writes — never let agents bypass the classification step.
