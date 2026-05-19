# ADR 005 — Spatial UI Architecture (Tiling Canvas + Workspace Views)

**Date:** 2026-01-01
**Status:** Accepted
**Scope:** `fikr-studio/` Electron app

---

## Context

Most note-taking apps present data as a list or tree. Fikr Studio's design philosophy treats knowledge as a **spatial, non-linear workspace** — more like a physical desk than a filing cabinet. The UI must support multiple modes of viewing the same data (scatter, structured, relational) without duplicating the underlying data model.

---

## Decision

The UI is organized around a **shared data model with multiple view layers**. Views are independent React component trees that all read from the same Zustand store. Switching views does not re-fetch data.

### Four Views

| View | Component | Purpose |
|---|---|---|
| Canvas / Tiling Area | `tiling-area.tsx` | Default — Masonry grid, raw capture, Ghost Notes |
| Kanban | `kanban-area.tsx` | AI-categorized columns, task management, drag-to-recategorize |
| Graph | `graph-area.tsx` | Node-link diagram of `influencedBy` relationships, semantic clusters |
| Studio Mode | `components/studio/` | Content generation — Ideation → Generate → Heatmap Refine |

### Tiling Area — The Core

- Masonry grid of `TileCard` components — **progressive disclosure**: collapsed by default, expand on `Enter`
- `ArrowUp/Down/Left/Right` navigate the 2D grid via a globally synchronized `highlightedBlockId`
- `NoteDetailPanel` takes over on expansion — full Markdown render via `react-markdown` + Tailwind Typography
- Ghost Notes appear inline alongside regular notes — visually distinct, can be "merged" into permanent notes

### Studio Mode — Separate State

- Managed by `studio-root.tsx` with its own `StudioProject` Zustand slice
- Does not pollute the Canvas data model
- Sub-views: Ideation (parameters) → Generate (streaming artifact) → Heatmap Refine (surgical editing)
- `artifact-drawer.tsx` shows the grounding context notes used for generation

### Theming

- CSS variables mapped to HSL values via Tailwind — enables premium glassmorphic dark mode
- `next-themes` manages dark/light switching
- Framer Motion provides spatial transitions (note additions, deletions, expansions)

---

## Consequences

**Positive:**
- Switching between Canvas/Kanban/Graph is instant — same data, different lens
- Keyboard-first design makes the app usable without a mouse
- Studio Mode's isolated state prevents draft content from cluttering the knowledge base
- Progressive disclosure keeps the grid scannable even with hundreds of notes

**Negative:**
- Masonry grid layout is complex to make keyboard-navigable — `highlightedBlockId` sync is fragile if the grid reflows
- Four views means four sets of UI bugs to maintain as the data model evolves
- Framer Motion animations add bundle size — must be imported lazily for large canvases

**Key rule:** All views read from the shared Zustand store. Views **never** maintain their own local data fetching logic — they are pure projections of the store state.
