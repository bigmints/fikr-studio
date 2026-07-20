# Architecture Decision Records (ADRs)

> ADRs document **why** architectural choices were made. They are written **before** implementation by the `architect` or `developer` role.

## Format

Use `TEMPLATE.md` to create a new ADR:

```bash
cp .agents/context/adrs/TEMPLATE.md .agents/context/adrs/<NNN>-<short-title>.md
```

Number files sequentially. The next number is always `max(existing) + 1`.

## Required Sections

Every ADR must have all four:
1. **Context** — the problem or situation
2. **Decision** — what was chosen and why
3. **Consequences** — positive outcomes and trade-offs
4. **Status** — `proposed` | `accepted` | `superseded-by-NNN`

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| 001 | React + Vite + TypeScript | accepted |
| 002 | TOON format for agent context files | accepted |
| 003–009 | See `context.toon → key_decisions` (inline decisions, no ADR file) | accepted |
| 010 | Typed widget lifecycle (actions[], archive-on-complete) | accepted |
| 015 | Widget DataSource as first-class citizen | accepted |
| 016 | Free search tools (DuckDuckGo, SearXNG) | accepted |

> **Decisions 003–009** are documented inline in `context.toon → key_decisions[]` rather than as separate ADR files. This was an intentional choice during rapid prototyping. Future decisions must have their own ADR file.

## Rules

- ADRs are **append-only**. Never modify an accepted ADR.
- To supersede an ADR: create a new one and set `Status: superseded-by-NNN` on the old one.
- ADR files are committed together with the code they document.
