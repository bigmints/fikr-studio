# ADR-023 — Local Document Extraction and Selective OCR

**Status:** `accepted`
**Date:** 2026-08-26
**Author:** electron-developer

---

## Context

Fikr currently validates uploaded PDFs and forwards them as model file inputs.
That proves transport but makes text extraction, OCR, page references, and
provider compatibility depend entirely on the configured model. Fikr needs a
deterministic document-reading boundary that works with its existing
provider-neutral Agents SDK runtime and keeps uploaded files ephemeral.

PDFs are untrusted and may contain malformed structures, excessive page counts,
large embedded images, or prompt-injection text. OCR is substantially more
expensive than embedded-text extraction and its WebAssembly and English language
assets are too large for Fikr's deliberately bounded application ASAR.

---

## Decision

Add a Fikr-owned `extract_document` Agents SDK tool backed by Node-native local
libraries. Use `unpdf` for page-preserving embedded-text extraction and render
only text-poor pages for local English OCR with `Tesseract.js`.

**Chosen approach:**

- Keep the existing trusted attachment validation and ephemeral data contract.
- Extract PDF text into bounded page records before the model reasons over it.
- Preserve the attachment ID, filename, page number, extraction method, and
  stable citation label for every returned page.
- Run OCR only when a page contains insufficient embedded text, with explicit
  page, pixel, time, and output limits.
- Return document content as untrusted quoted Markdown. Instructions contained
  in a document never override Fikr's agent, skill, tool, or approval policy.
- Do not forward PDFs as provider `input_file` payloads. PDF-grounded claims
  must come through the local extraction tool; image attachments continue to
  use the configured vision model for visual reasoning.
- Package canvas, OCR WebAssembly, and English language data outside the ASAR so
  the packaged Electron worker can load them without network access.

**Alternatives considered:**

- Microsoft MarkItDown or PyMuPDF sidecar — rejected because a Python runtime
  would complicate Electron installation, signing, and updates.
- Provider-only PDF understanding — rejected because it cannot provide
  deterministic extraction, capability-independent behavior, or verified page
  provenance.
- OCR every page — rejected because it is slow, memory-intensive, and less
  accurate than embedded text for ordinary digital PDFs.
- One broad office-document parser — deferred until its PDF accuracy and
  packaged Electron behavior outperform the focused pipeline on Fikr's corpus.

---

## Consequences

**Positive:**

- Text PDFs become provider-independent and page-citable.
- Scanned pages have an offline fallback without silently uploading documents to
  another extraction service.
- Extraction and orchestration can be tested independently from a live model.
- The tool boundary can later support DOCX, PPTX, and other document adapters.

**Trade-offs / New constraints:**

- OCR increases the installed application size and is initially English-only.
- Complex tables, charts, handwriting, and unusual layouts may still require
  model vision or a future specialized parser.
- Native canvas and OCR assets must be verified in packaged macOS builds.
- Very large or predominantly scanned documents may return bounded warnings
  instead of processing every page in one chat turn.

---

## Implementation Notes

**Files affected:**

- `lib/document-extractor.js` — bounded PDF extraction, rendering, OCR, and
  provenance.
- `lib/agent-runtime.js` / `lib/fikr-skills.js` — tool registration, required
  extraction behavior, citations, and run events.
- `electron-builder.json` / `scripts/check-asar.mjs` — unpacked native and OCR
  runtime assets plus packaging verification.
- `tests/document-extractor.test.js` / `tests/agent-runtime.test.js` — extraction
  and orchestration regressions.

---

## References

- Related ADR: `016-agents-sdk-tool-runtime.md`
- Related ADR: `017-bounded-chat-attachments.md`
- `https://github.com/unjs/unpdf`
- `https://github.com/naptha/tesseract.js`
