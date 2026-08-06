import test from "node:test";
import assert from "node:assert/strict";

import {
  insertAtSelection,
  markdownEntryDraftKey,
  normalizeMarkdownForRichEditor,
  shouldExpandMarkdownPaste,
} from "../lib/markdown-entry.js";

test("keeps ordinary quick-capture paste compact", () => {
  assert.equal(shouldExpandMarkdownPaste("A short thought for later"), false);
  assert.equal(shouldExpandMarkdownPaste("https://example.com/reference"), false);
});

test("expands structured and multi-paragraph Markdown paste", () => {
  assert.equal(shouldExpandMarkdownPaste("# Heading\n\nA paragraph"), true);
  assert.equal(shouldExpandMarkdownPaste("- [ ] First task"), true);
  assert.equal(shouldExpandMarkdownPaste("**Important**"), true);
  assert.equal(shouldExpandMarkdownPaste("| Name | State |\n| --- | --- |\n| Fikr | Ready |"), true);
  assert.equal(shouldExpandMarkdownPaste("First paragraph\n\nSecond paragraph"), true);
});

test("inserts pasted Markdown at the compact input selection", () => {
  assert.deepEqual(insertAtSelection("Before after", "**middle**", 7, 7), {
    value: "Before **middle**after",
    cursor: 17,
  });
  assert.deepEqual(insertAtSelection("Before old after", "new", 7, 10), {
    value: "Before new after",
    cursor: 10,
  });
});

test("normalizes clipboard newlines and scopes recovered drafts by project", () => {
  assert.deepEqual(insertAtSelection("", "one\r\n\r\ntwo", 0, 0), {
    value: "one\n\ntwo",
    cursor: 8,
  });
  assert.equal(markdownEntryDraftKey("project-a"), "fikr-markdown-entry-draft-v1:project-a");
});

test("keeps inline code authoritative when rich-editor marks conflict", () => {
  assert.equal(normalizeMarkdownForRichEditor("**`npm test`**"), "`npm test`");
  assert.equal(
    normalizeMarkdownForRichEditor("**Run `npm test` before saving**"),
    "Run `npm test` before saving",
  );
  assert.equal(normalizeMarkdownForRichEditor("***`code`***"), "`code`");
  assert.equal(normalizeMarkdownForRichEditor("~~Use `legacy`~~"), "Use `legacy`");
  assert.equal(
    normalizeMarkdownForRichEditor("Before **bold** and `code` after"),
    "Before **bold** and `code` after",
  );
});

test("does not rewrite fenced code while normalizing rich-editor markdown", () => {
  const fenced = "```md\n**`literal`**\n```\n\n**`rendered`**";
  assert.equal(
    normalizeMarkdownForRichEditor(fenced),
    "```md\n**`literal`**\n```\n\n`rendered`",
  );
});
