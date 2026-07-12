# ADR 009 — External Relay Ingestion

**Date:** 2026-07-12
**Status:** Accepted
**Scope:** `fikr-studio/`

## Context

Fikr Studio needs to ingest external webhook data while keeping its workspace
local-first and its cloud authority on `fikr.one`. The existing cloud relay
poller executes validated MCP requests in the Electron main process.

## Decision

- The Electron main process leases external relay messages from authenticated
  `fikr.one` APIs; the renderer never reads the relay queue directly.
- External payloads are normalized into `create_note` MCP calls and executed
  through the existing `executeMcpRpc()` path.
- Successful execution acknowledges the lease. Failures negatively acknowledge
  it so `fikr.one` can retry with backoff or dead-letter the message.
- Polling is short and adaptive: faster after work is found and progressively
  slower while idle. No persistent cloud connection is used.

## Consequences

- External data follows the same workspace mutation path as local MCP writes.
- Delivery is at least once, so the server lease protocol and message identity
  remain authoritative for retry handling.
- Relay ingestion only runs for an authenticated Plus or Pro account.

