# ADR 008 — Production Renderer and Relay Boundary

**Date:** 2026-07-10
**Status:** Accepted
**Supersedes:** ADR 001 state-management details and ADR 005

## Context

Historical architecture documents claimed a Zustand store that is not present
in the implementation. The renderer also read subscription fields, created
relay keys, and processed the cloud MCP queue through the Firebase client SDK.
That made the desktop security boundary depend on client-side Firestore rules
and allowed product authority to drift away from the server.

## Decision

- Workspace views use the implemented React state owned by `app/page.tsx` and
  Studio components.
- Firebase in the renderer is used only for shared SSO authentication.
- UID, subscription plan, relay keys, cloud workspace access, and relay queue
  operations are derived or authorized by `fikr.one` after ID-token validation.
- The Electron main process polls a narrowly scoped Studio relay API and runs
  accepted MCP payloads through the same validated execution path as local IPC.
- Local MCP transport remains loopback-only and requires a per-install token.

## Consequences

- Renderer compromise cannot directly write plan or relay fields in Firestore.
- Cloud Relay keeps working while Studio is open without exposing Firestore
  queue credentials or collection layout to the renderer.
- Historical ADRs remain available but are explicitly marked superseded.
