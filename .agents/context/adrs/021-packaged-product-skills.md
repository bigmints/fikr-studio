# ADR-021 — Packaged Product Skills

**Status:** `accepted`
**Date:** 2026-08-26
**Author:** electron-developer

---

## Context

Fikr Chat already required an `activate_skill` tool call, but its skill definitions
were anonymous prompt fragments embedded in the agent runtime. They could not be
versioned, packaged, inspected, or expanded independently, and the social creation
contract covered only LinkedIn and X with no platform-level validation.

Fikr needs reusable skills comparable to modern assistant skill systems while
retaining its existing boundary: the Agents SDK orchestrates, and Fikr owns the
skills, tools, knowledge, security, provider routing, persistence, and UI.

## Decision

Introduce a Fikr-owned product skill registry with packaged skill directories.
Each packaged skill contains a versioned manifest plus a complete `SKILL.md` that
is loaded by the trusted Electron main-process runtime.

The first packaged skill is **Social Media Writer**. It:

- activates automatically for LinkedIn, X, Substack, and Medium requests;
- declares the Fikr tools it may use;
- provides platform-specific format, length, structure, and hashtag guidance;
- produces only validated `social-content` artifacts through
  `create_social_content`;
- enforces hard platform constraints in code, including LinkedIn and X character
  limits, X thread segmentation, supported format/platform pairs, and hashtag
  limits;
- remains provider-neutral and does not publish or persist without a user action.

The runtime continues to expose only the skill selected for the current intent.
The model must activate it before its terminal tool can run, and the renderer shows
the activation in Agent activity.

## Consequences

**Positive:**

- Skills are inspectable, versioned application assets rather than hidden prompt
  strings.
- Platform behavior is consistent across providers and fails closed at the tool
  boundary.
- New writing or domain skills can be added without replacing the agent runtime.
- Creations preserve platform, format, tags, source IDs, and skill provenance.

**Trade-offs:**

- Packaged skills must be included in Electron release assets and tested there.
- A skill manifest and its Markdown instructions must evolve together.
- Soft targets such as ideal word count remain model guidance; only objective
  platform constraints should block a tool result.

## Implementation Notes

- `skills/social-media-writer/manifest.json` — identity, triggers, tool allowlist,
  and platform profiles.
- `skills/social-media-writer/SKILL.md` — complete authoring instructions.
- `lib/fikr-skills.js` — trusted product skill registry and packaged loader.
- `lib/agent-runtime.js` — activation, tool authorization, and platform validation.
- `lib/fikr-chat.ts`, `lib/chat-domain.mjs`, and creation UI — generalized
  social-content contract and persisted metadata.
- `electron-builder.json` — packages skill assets with the desktop app.

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
- Related ADR: `017-bounded-chat-attachments.md`
