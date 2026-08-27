# ADR-024 — Explicit Chat and Creation Cloud Recovery

**Status:** `accepted`
**Date:** 2026-08-26
**Author:** electron-developer

---

## Context

An initialized Fikr cloud workspace is authoritative, including explicit empty
chat and creation arrays. That is correct for ordinary multi-device deletion,
but it also means a deliberately restored local chat/creation snapshot is
replaced during the next authenticated startup. Notes must not be rolled back
as a side effect of recovering these newer workspace sections.

---

## Decision

Support a fail-closed, one-time local recovery intent for chat threads and
creations.

- The intent must use the exact versioned recovery kind and a positive integer
  request timestamp.
- Both recovered arrays must be bounded, contain objects with unique bounded
  IDs, and pass before either section can override cloud state.
- Cloud projects, the active note workspace, and all unrelated cloud fields
  remain authoritative.
- A valid recovery selection is written through the existing authenticated
  workspace API. The intent itself is omitted from the uploaded workspace.
- Legacy cloud endpoints and schema-v2 workspaces that have not initialized
  creation sync cannot erase a non-empty local creation collection. Once the
  server confirms creation-sync initialization, explicit empty creation arrays
  are authoritative.
- The local intent remains on disk if the cloud save fails; a successful save
  replaces the local cache with the marker-free recovered workspace.

---

## Consequences

**Positive:**

- Approved recovery survives authenticated startup and subsequent restarts.
- Notes cannot be rolled back by a chat/creation recovery operation.
- Invalid, duplicate, oversized, or unmarked local arrays cannot override an
  initialized cloud workspace.

**Trade-offs / New constraints:**

- Recovery intent is an operational escape hatch, not a general merge policy.
- A recovery operator must create the marker only after validating an exact
  snapshot and retaining a pre-recovery copy.

---

## Implementation Notes

- `lib/cloud-seed.js` validates and applies the one-time selection.
- `main.js` already awaits a seed write before returning or caching selection.
- `tests/cloud-seed.test.js` proves section isolation and fail-closed behavior.

---

## References

- Related ADR: `007-production-data-and-search-boundary.md`
- Related ADR: `018-protect-external-mcp-mutations.md`
