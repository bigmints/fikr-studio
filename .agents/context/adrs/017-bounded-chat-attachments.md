# ADR-017 — Bounded Chat Attachments

**Status:** `accepted`
**Date:** 2026-08-24
**Author:** electron-developer

---

## Context

Fikr Chat accepts only text even though the chosen Agents SDK protocol and the
OpenAI-compatible provider path support image and file content parts. Users need
to ask questions about PDFs and images without weakening the trusted
renderer-to-main-process boundary or silently storing large binary payloads in
the workspace JSON.

Attachment data is user-controlled and may contain prompt injection, malformed
base64, misleading MIME declarations, or unexpectedly large payloads. Provider
and model capabilities also vary, so Fikr must validate the shared contract and
surface provider failures instead of claiming every configured model is
multimodal.

---

## Decision

Add a bounded, provider-neutral attachment contract to Fikr Chat and pass it to
the existing Agents SDK run as normalized `input_image` and `input_file` content
parts.

**Chosen approach:**

- Accept PDF, PNG, JPEG, and WebP files from the chat composer.
- Allow at most four attachments, 10 MB per file, and 20 MB combined.
- Read files in the renderer only for preview and the current request, then
  validate MIME type, data URL, decoded size, and file signature again in the
  trusted Electron main-process runtime.
- Send image data as Agents SDK `input_image` items and PDF data as
  `input_file` items. The existing OpenAI Chat Completions adapter translates
  these to provider-compatible multimodal content parts.
- Route attachment requests through the configured vision-task model while
  text-only chat continues to use the tools-task model. OpenRouter's default
  vision model is `openai/gpt-4o-mini`, because its default DeepSeek tools
  model does not expose image-input endpoints.
- Persist only bounded attachment metadata on chat messages. Do not place
  base64 file bodies in the workspace JSON, analytics, traces, or logs.
- Treat uploaded content as untrusted user data. It may inform the answer, but
  instructions embedded inside an attachment never override Fikr's agent,
  skill, tool, or approval rules.
- Keep the existing managed-cloud text route fail-closed for attachments until
  that API supports the same validated contract. BYOK and explicit local
  providers use the trusted desktop Agents SDK path.

**Alternatives considered:**

- Store uploaded files inside the workspace JSON — rejected because binary data
  would make local persistence and cloud sync large and fragile.
- Add a PDF parsing dependency and send extracted text only — rejected because
  the installed Agents SDK already supports PDF file inputs and model-side PDF
  handling preserves page images, charts, and layout.
- Build a second direct multimodal completion path — rejected because it would
  bypass Fikr's Agents SDK orchestration, skills, tools, and MCP runtime.

---

## Consequences

**Positive:**

- One chat composer supports common images and PDFs with previews and removable
  attachment chips.
- Attachments remain inside the existing provider-routing and tool-based agent
  architecture.
- Workspace persistence stays compact while chat history still records which
  files accompanied each request.
- No new runtime dependency is required.

**Trade-offs / New constraints:**

- Reopening a chat preserves attachment metadata, not the original binary.
- Follow-up turns do not resend prior binaries; users must attach a file again
  when a later turn needs its full contents.
- The selected provider model must support the relevant image or PDF input
  format. Fikr reports provider rejection without fallback or silent omission.
- Managed Plus/Pro chat remains text-only until its cloud contract is upgraded.

---

## Implementation Notes

**Files affected:**

- `components/fikr-chat.tsx` — picker, previews, removal, message display.
- `lib/ai-settings.ts` — provider-specific default vision model.
- `lib/fikr-chat.ts` — attachment types and renderer-to-agent request wiring.
- `lib/chat-domain.mjs` — persisted metadata normalization.
- `lib/agent-runtime.js` — trusted validation and multimodal Agents SDK input.
- `tests/agent-runtime.test.js` and `tests/chat-domain.test.mjs` — validation,
  model-input, and persistence coverage.

---

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
- Official Agents SDK guidance: `https://developers.openai.com/api/docs/guides/agents`
- Official file input guidance: `https://developers.openai.com/api/docs/guides/pdf-files`
- Official image input guidance: `https://developers.openai.com/api/docs/guides/images-vision`
