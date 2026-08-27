# ADR-022 — Secure Built-in Web Fetch

**Status:** `accepted`
**Date:** 2026-08-26
**Author:** electron-developer

---

## Context

Fikr's agent needs to read public web pages as source material for research, knowledge-note drafting, and social writing. Sending this work through an arbitrary MCP server would make a core capability depend on external configuration, while a renderer-side browser fetch would expose networking outside the trusted Electron boundary. Raw HTML is also noisy, and fetched pages can contain prompt injection or links that redirect into private networks.

---

## Decision

Implement `fetch_web_page` as a Fikr-owned Agents SDK function tool in Electron main. A separately testable networking module validates every URL and redirect, resolves public DNS addresses, enforces response/time/redirect limits, extracts the primary document with Mozilla Readability on LinkeDOM, and converts the result to bounded GFM Markdown with Turndown.

Fetched content is returned as explicitly untrusted quoted source material. The tool does not execute scripts, use cookies, access authenticated pages, bypass paywalls, or write the result to Knowledge.

**Chosen approach:**

- `@mozilla/readability` for maintained article extraction.
- `linkedom` for a compact server-side DOM implementation.
- A minified CommonJS build of LinkeDOM's self-contained worker runtime is
  packaged with its ISC license; the dependency's unused duplicate module
  trees are excluded from `app.asar`.
- `turndown` plus `turndown-plugin-gfm` for readable Markdown and tables/task lists.
- Fikr-owned URL/DNS/redirect/content guards so parser choice never defines the security boundary.

**Alternatives considered:**

- Hidden Electron `BrowserWindow` extraction — rejected because it is heavier, harder to isolate and test, and expands renderer/web-content risk.
- Provider-hosted web search/fetch — rejected because Fikr must remain provider-neutral and BYOK-compatible.
- Web-fetch MCP dependency — rejected because webpage reading is a core local capability and should work without third-party setup.

---

## Consequences

**Positive:**

- Users can ask Fikr to read a URL and immediately research, synthesize, draft a note, or create platform-specific content from it.
- Extraction quality comes from established open-source libraries while SSRF and resource limits remain under Fikr's control.
- The module can be tested deterministically with injected DNS and fetch implementations.

**Trade-offs / New constraints:**

- JavaScript-only pages, login walls, bot challenges, and paywalled content may not yield an article.
- The added production dependencies must remain within the 10 MB packaged `app.asar` gate.
- Web sources are separate from Fikr note citations and must not be presented as stored-knowledge evidence.

---

## Implementation Notes

**Files affected:**

- `lib/web-fetch.js`
- `lib/agent-runtime.js`
- `lib/fikr-skills.js`
- `skills/social-media-writer/manifest.json`
- `tests/web-fetch.test.js`
- `tests/agent-runtime.test.js`
- `electron-builder.json`
- `scripts/check-asar.mjs`

---

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
- Related ADR: `021-packaged-product-skills.md`
