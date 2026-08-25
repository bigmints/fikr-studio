# ADR-015 — Unified Chat-First Fikr Experience

**Status:** `accepted`
**Date:** 2026-08-23
**Author:** electron-developer

---

## Context

Fikr exposed separate “Fikr Intel” and “Fikr Studio” products even though users wanted one knowledge-to-creation workflow. The existing note workspace, local-first persistence, search index, managed AI, BYOK, and authenticated cloud boundaries must remain intact.

---

## Decision

**Chosen approach:** Fikr opens to a unified Chat surface. The existing note workspace is preserved under Knowledge, generated social artifacts are shown inline and saved under Creations only after explicit confirmation, and conversations persist in the existing combined workspace payload.

**Alternatives considered:**
- Keep the Intel/Studio app switcher — rejected because it makes one user journey look like two products.
- Replace the existing Knowledge workspace — rejected because its note, graph, search, organization, and local-first behavior remain valuable.
- Add a new AI provider or credential path — rejected because the managed/BYOK boundary already owns generation securely.

---

## Consequences

**Positive:**
- Users can ask, understand, and create without choosing a product mode first.
- Citations retain exact project and note identity and open directly in Knowledge.
- Knowledge and creation writes remain deliberate and duplicate-safe.
- Existing local and cloud workspace compatibility is preserved.

**Trade-offs / New constraints:**
- Legacy `studioProjects` remains the internal persistence field for Creations until a later schema migration.
- Stored notes must always be treated as untrusted quoted context during generation.
- Deterministic UI fixtures must stay behind `NEXT_PUBLIC_FIKR_UI_TEST_MODE=1`.

---

## Implementation Notes

**Files affected:**
- `app/page.tsx`
- `components/project-sidebar.tsx`
- `components/fikr-chat.tsx`
- `components/creations-page.tsx`
- `lib/fikr-chat.ts`
- `lib/chat-domain.mjs`

---

## References

- Related ADR: `007-production-data-and-search-boundary.md`
- Product spec: `docs/superpowers/specs/unified-fikr-chat.md`
