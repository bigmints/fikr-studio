# ADR 007 — Production Data and Search Boundary

**Date:** 2026-07-10
**Status:** Accepted
**Supersedes:** ADR 002 persistence details and ADR 006 local search/runtime details

## Context

The shipped desktop artifact contained a Firebase Admin service-account key,
while project context described SQLite, BM25, and WebLLM components that were not
the runtime implementation. The Xenova embedding dependency also introduced a
critical production advisory.

## Decision

- The Electron workspace remains locally available in a versioned JSON file.
- Firebase Admin runs only on `fikr.one`.
- The desktop sends a Firebase ID token to `fikr.one`; the server verifies it,
  derives the UID, checks Plus/Pro, and scopes every operation to that UID.
- Free users never receive cloud workspace access.
- The renderer never reads or writes Firestore for account, plan, workspace, or
  relay data; those operations use token-verified `fikr.one` APIs.
- Local relevance uses deterministic lexical feature vectors with no model
  download or native inference dependency.
- Plus/Pro semantic search remains a server capability.
- Generative AI requires BYOK or verified managed-plan access; no offline local
  generative model is promised.
- BYOK credentials remain encrypted at rest and are decrypted only in the
  Electron main process. Renderer calls use a fixed-provider, size-bounded IPC
  proxy and receive response data, never the credential.

## Consequences

- Desktop releases contain no privileged cloud credential.
- Local capture and search remain available offline.
- Local relevance is lexical rather than model-semantic.
- Existing workspace IDs and deletion baselines are preserved during migration.
- A server-owned initialization marker seeds a truly empty cloud from existing
  local data exactly once; initialized empty workspaces remain authoritative.
- A compromised renderer cannot directly read stored BYOK credentials or choose
  an arbitrary upstream host for authenticated provider requests.
