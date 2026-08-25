# ADR-016 — Agents SDK Tool Runtime

**Status:** `accepted`
**Date:** 2026-08-24
**Author:** electron-developer

---

## Context

Fikr's chat-first experience currently retrieves relevant local notes, sends one
provider-neutral chat-completions request, and parses a cited answer or social
artifact. That is sufficient for grounded generation, but it is not an agent
runtime: the model cannot perform repeated tool calls, select skills, connect to
external MCP servers, pause for approval, or expose a structured run timeline.

Fikr's architecture principle is tool-based. Fikr must continue to own its
knowledge store, skills, tools, security policy, UI, and model/provider routing.
The orchestration dependency must therefore remain behind a Fikr-owned boundary
and must not introduce an OpenAI API-key requirement or bypass the trusted
Electron main-process boundary.

---

## Decision

Use the TypeScript OpenAI Agents SDK to run the bounded agent loop while Fikr
owns every domain and security boundary around it.

**Chosen approach:**

- Define a provider-neutral Fikr agent request, result, and event contract.
- Run the Agents SDK in the trusted Electron main process.
- Adapt the existing OpenRouter, OpenAI, Gemini, and explicit local-AI routes
  without adding a required OpenAI credential or silent fallback.
- Expose validated Fikr domain operations to the SDK as function tools.
- Classify renderer output only from validated tool state: ordinary answers,
  explicit insight drafts, knowledge-note drafts, and creations are distinct
  result kinds. Citations are grounding metadata and never imply an insight.
- Represent skills as Fikr-owned declarative instructions with an allowlist of
  tools, rather than encoding skills as SDK-specific workflow code.
- Treat Fikr's internal tool kernel as the source of truth. The internal agent
  and the existing Fikr MCP server use adapters over the same implementations;
  the internal agent does not call Fikr through its own localhost MCP endpoint.
- Add outbound MCP clients through explicit, trusted connection records with
  HTTPS-or-loopback URL validation and an explicit per-tool allowlist.

**Alternatives considered:**

- Extend the custom one-shot chat path into an agent loop — rejected because it
  would require Fikr to maintain loop control, tool-result continuation,
  cancellation, limits, validation, approvals, and MCP lifecycle behavior.
- Adopt LangChain/LangGraph, LlamaIndex, or Mastra — rejected because their
  broader workflow and retrieval abstractions overlap Fikr-owned domain logic
  and add more framework surface than the required agent loop.
- Send all tools to a hosted provider-native MCP feature — rejected because it
  would weaken local-first execution, compatible-provider portability, and the
  Electron security boundary.

---

## Consequences

**Positive:**

- Fikr gains repeated model-directed tool calling and a path to specialist
  agents, skills, MCPs, approvals, sessions, and run tracing.
- Existing knowledge retrieval, citations, artifacts, persistence, and provider
  selection remain product-owned and independently testable.
- The renderer receives structured, inspectable run events without receiving
  provider credentials or direct OS/tool access.
- Persistence actions are fail-closed: only `draft_insight` can expose Save
  insight, while `draft_knowledge_note` and creation tools expose their own
  review actions.
- A Fikr-owned runtime contract limits dependency lock-in.

**Trade-offs / New constraints:**

- `@openai/agents` becomes a runtime dependency and must be pinned and audited.
- OpenAI-compatible providers differ in tool-call support; Fikr must fail clearly
  when the selected model cannot emit compatible function calls.
- Tool schemas and results must stay bounded, validated, and safe to return to a
  model. Sensitive or mutating MCP calls require explicit policy and approval.
- SDK tracing must remain disabled by default so local knowledge and tool data
  are not exported implicitly.
- Managed Plus/Pro Chat remains on the existing cloud endpoint until its API can
  return tool calls; it therefore does not yet receive Agents SDK orchestration.

---

## Implementation Notes

**Files affected:**

- `lib/agent-runtime.js` — Fikr-owned request, skill, tool, event, MCP, and
  compatible-provider Agents SDK runtime.
- `lib/agent-mcp-config.js` — validated, owner-only outbound MCP persistence.
- `main.js` / `preload.js` — trusted IPC entrypoint and renderer event stream.
- `lib/fikr-chat.ts` — retrieval and prompt construction feeding the agent run.
- `components/fikr-chat.tsx` — run status, tool activity, and final artifacts.
- `components/agent-mcp-connections.tsx` — discovery and per-tool allowlisting.
- `tests/agent-runtime.test.js` and `tests/agent-mcp-config.test.js` — deterministic
  SDK loop, citation ordering, tool policy, and MCP persistence checks.

The renderer-facing chat result contract includes an explicit `outputKind` plus
the matching validated draft payload. Existing messages without that contract
default to a creation only when they contain a valid artifact; otherwise they
default to an ordinary answer.

---

## References

- Related ADR: `003-mcp-two-tier-architecture.md`
- Related ADR: `008-production-renderer-and-relay-boundary.md`
- Related ADR: `015-unified-chat-first-experience.md`
- Official OpenAI Agents SDK guidance: `https://developers.openai.com/api/docs/guides/agents`
- Official MCP safety guidance: `https://developers.openai.com/api/docs/guides/tools-connectors-mcp`
