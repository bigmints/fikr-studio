# ADR-012 — Markdown-Native Rich Writing Surface

**Status:** `accepted`
**Date:** 2026-08-05
**Author:** electron-developer

---

## Context

ADR-011 established raw Markdown as the authoritative entry format and introduced a CodeMirror source editor with a separate preview. In practice, making split source and preview the default produces an IDE-like experience: visible line gutters and Markdown punctuation occupy half the screen while an empty preview occupies the other half. The requested product direction is closer to MarkText, Obsidian Live Preview, Notion, and Quill: a calm document canvas where formatting is visible while writing.

Quill provides polished rich-text interaction but stores a Delta document model. Adopting Delta alongside Markdown would create two competing authoritative formats. Fikr Studio already uses Tiptap, whose official Markdown extension can parse and serialize Markdown through its ProseMirror document model while leaving the persisted value as Markdown.

---

## Decision

The expanded knowledge-entry editor defaults to a Tiptap rich writing surface configured with the official Markdown extension. Tiptap's in-memory document is an editing projection only; every update is serialized back to the same authoritative raw Markdown string.

CodeMirror remains available as an explicit Source mode, and `react-markdown` remains the read-only Preview mode. The permanent split view is removed from the primary interaction.

**Chosen approach:**

- Default to a centered, distraction-free rich writing canvas.
- Use Tiptap StarterKit plus its official Markdown manager for supported CommonMark editing and serialization.
- Keep source and preview as user-selected modes, never as competing stored documents.
- Use a compact floating formatting toolbar and selection bubble menu instead of a full-width IDE toolbar.

**Alternatives considered:**
- Restyle CodeMirror only — rejected because Markdown punctuation and code-editor interaction remain the primary experience.
- Adopt Quill Delta — rejected because it is not Markdown-native and would require a second persisted representation or a lossy conversion boundary.
- Integrate MarkText's internal editor — rejected because it is application-specific rather than a stable React editor boundary for this codebase.

---

## Consequences

**Positive:**
- The default experience presents one formatted document rather than source beside output.
- Markdown remains portable and authoritative in the existing workspace schema.
- Users can still inspect and edit exact Markdown in Source mode.
- The existing Tiptap and ProseMirror runtime is reused.

**Trade-offs / New constraints:**
- Rich mode only promises structures supported by the configured Tiptap Markdown extensions; unsupported syntax remains available in Source mode.
- Rich/source synchronization must avoid feedback loops and preserve explicit save boundaries.
- The official Tiptap Markdown extension becomes a renderer dependency.

---

## Implementation Notes

**Files affected:**
- `components/markdown-entry-editor.tsx`
- `package.json`
- `package-lock.json`

---

## References

- `011-source-first-markdown-entry-editor.md`
- https://github.com/marktext/marktext
- https://github.com/slab/quill
- https://github.com/ueberdosis/tiptap/tree/main/packages/markdown
