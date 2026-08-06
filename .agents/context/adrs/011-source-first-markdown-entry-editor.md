# ADR-011 — Source-First Markdown Entry Editor

**Status:** `accepted`
**Date:** 2026-08-05
**Author:** electron-developer

---

## Context

Fikr Studio's Entry surface is currently a single-line input, while existing note editing uses a textarea and the Studio article editor converts Markdown to HTML and back through a deliberately limited converter. A full Markdown authoring workflow must preserve GitHub-Flavored Markdown exactly, support keyboard-first editing and preview, and work for both new and existing notes without creating competing document representations.

The existing HTML-to-Markdown conversion does not preserve the complete source representation of tables, fenced-code metadata, nested structures, task state, or intentional spacing. Using that path for knowledge entries would make edits lossy.

---

## Decision

Raw Markdown remains the canonical value for every knowledge entry. The expanded Entry surface uses a source editor backed by CodeMirror 6, while preview rendering continues through the existing `react-markdown` and `remark-gfm` stack.

**Chosen approach:**

- Use CodeMirror 6 through its React adapter for Markdown source editing, selection-aware formatting commands, history, search, and keyboard behavior.
- Keep one draft Markdown string shared by compact capture and the expanded editor.
- Submit new notes or update existing notes only from an explicit save boundary; AI enrichment is not triggered per keystroke.
- Persist unsaved new-entry drafts locally so closing or restarting the renderer does not silently discard writing.

**Alternatives considered:**
- Reuse the current Tiptap editor — rejected because its HTML round trip is lossy for the required Markdown surface.
- Build on a plain textarea — rejected because syntax-aware selection, search, history, indentation, and robust keyboard behavior would require rebuilding editor infrastructure.
- Store Tiptap JSON alongside Markdown — rejected because two authoritative document representations create synchronization and migration risk.

---

## Consequences

**Positive:**
- Markdown remains portable, inspectable, and lossless in the existing local JSON workspace.
- New and existing notes can share one editor component and formatting model.
- Preview continues to use the renderer already used elsewhere in Fikr Studio.
- Editor capabilities can grow without changing the persisted note schema.

**Trade-offs / New constraints:**
- The renderer gains CodeMirror packages and associated bundle weight.
- Rich HTML clipboard conversion remains a separate concern; Markdown and plain-text paste are preserved directly in this slice.
- Obsidian-specific vault features such as backlinks, embeds, and plugins are not implied by the editing dependency.

---

## Implementation Notes

**Files affected:**
- `components/markdown-entry-editor.tsx`
- `components/vim-input.tsx`
- `components/note-detail-panel.tsx`
- `app/page.tsx`
- `package.json`

New-note drafts use a versioned local-storage key. Existing-note drafts stay component-local until saved or discarded.

---

## References

- Related ADR: `001-nextjs-electron-hybrid-architecture.md`
- Related ADR: `007-production-data-and-search-boundary.md`
