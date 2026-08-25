# ADR-019 — Standard MCP Config Import and Local Servers

**Status:** `accepted`
**Date:** 2026-08-25
**Author:** electron-developer

---

## Context

Fikr Chat originally accepted only a manually entered server name, URL, and transport. That does not match how MCP providers normally distribute connection details: users are given a JSON `mcpServers` entry, which may describe either a hosted endpoint or a local stdio command. The URL-only form also exposed transport terminology before the user had established a connection.

Outbound MCP access must remain local-first and fail-closed. A server may not be used by Chat until Fikr has connected, discovered its tools, and the user has explicitly selected an allowlist.

---

## Decision

Fikr Studio will accept one standard `mcpServers` JSON entry at a time and support both hosted HTTP/SSE endpoints and local stdio commands. A simple hosted-server form remains available, but transport selection is inferred or read from the pasted config.

Connection secrets may be submitted to Electron main through trusted IPC and stored in the permission-restricted MCP config file. Renderer list responses expose only safe connection metadata. Local commands are spawned directly without a shell, and no server is persisted without a non-empty tool allowlist.

**Chosen approach:**

- Parse common MCP JSON in the renderer for a reviewable connection draft.
- Validate the descriptor again in Electron main before discovery, storage, or execution.
- Discover tools first, then require an explicit per-tool permission selection.
- Support `command`, `args`, optional `env`, and optional absolute `cwd` for stdio servers.

**Alternatives considered:**

- URL-only form — rejected because it excludes the common local-command MCP format.
- Arbitrary shell command string — rejected because shell evaluation would unnecessarily widen command-injection risk.
- Save first and ask for permissions later — rejected because an undiscovered server must not enter the Chat runtime.

---

## Consequences

**Positive:**

- Users can paste the setup block supplied by an MCP provider.
- Hosted and local MCP servers share one clear review and permission flow.
- Tool access remains explicit and fail-closed.

**Trade-offs / New constraints:**

- Local MCP commands can run software on the user’s Mac when the user chooses to connect or use them.
- Environment values and remote headers are sensitive and must never be returned in renderer list responses or logs.
- The first version imports one server per pasted config so each server receives an independent permission review.

---

## Implementation Notes

**Files affected:**

- `components/agent-mcp-connections.tsx`
- `lib/mcp-connection-config.mjs`
- `lib/agent-runtime.js`
- `lib/agent-mcp-config.js`
- `main.js`

---

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
