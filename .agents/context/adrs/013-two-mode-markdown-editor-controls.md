# ADR-013 — Two-Mode Markdown Editor Controls

**Status:** `accepted`
**Date:** 2026-08-05
**Author:** electron-developer

---

## Context

The rich Write surface already renders the Markdown document as users will read it, so a separate read-only Preview mode duplicates the same outcome and adds header complexity. The first AI-formatting interaction also used a full editor overlay, which displaced the document for two simple actions.

## Decision

This decision supersedes ADR-012 only where it retained a separate Preview mode.

The expanded ENTRY editor has two document modes only:

- **Write** — the primary Markdown-native rich editor.
- **Source** — the exact raw Markdown escape hatch.

Preview mode and its keyboard toggle are removed. AI **Format** and **Clean up** are icon-only actions in the existing floating editor toolbar. They operate directly on the selection or document, preserve wording, expose progress and errors inline, and use the editor's normal Undo history.

This change is scoped to the editor controls and does not alter global theme tokens or semantic tag colors.

## Consequences

**Positive:**

- Less duplicated navigation and no full-screen AI detour.
- The document remains visible while AI actions run.
- The toolbar remains compact while tooltips and accessible names describe both actions.

**Trade-offs:**

- Users who want raw syntax must switch to Source; there is no separate read-only rendering mode.
- AI results apply directly, so Undo and stale-document protection are required safeguards.

## References

- `012-markdown-native-rich-writing-surface.md`
- `components/markdown-entry-editor.tsx`
