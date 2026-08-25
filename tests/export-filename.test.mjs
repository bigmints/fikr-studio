import test from "node:test";
import assert from "node:assert/strict";

import { makeExportFilename } from "../lib/export-filename.mjs";

test("creates clean filenames for emoji-prefixed workspace names", () => {
  assert.equal(makeExportFilename("✨ General", "fikrdata", "project"), "general.fikrdata");
  assert.equal(makeExportFilename("  -- Product 🚀 Notes --  ", "MD"), "product-notes.md");
});

test("falls back safely and bounds the filename", () => {
  assert.equal(makeExportFilename("✨", "fikrdata", "project"), "project.fikrdata");
  assert.equal(makeExportFilename("a".repeat(80), "txt").length, 64);
  assert.throws(() => makeExportFilename("note", "../md"), /extension/i);
});
