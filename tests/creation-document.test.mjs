import test from "node:test";
import assert from "node:assert/strict";
import {
  creationBodyMarkdown,
  creationDocumentFromArtifact,
  creationTitleFromMarkdown,
  ensureCreationDocument,
} from "../lib/creation-document.mjs";

test("legacy creation bodies gain one editable H1 title", () => {
  assert.equal(
    ensureCreationDocument("A finished opening paragraph.", "A better launch"),
    "# A better launch\n\nA finished opening paragraph.",
  );
});

test("existing creation document title remains authoritative", () => {
  const document = "# A completely new title\n\nThe edited body.";
  assert.equal(ensureCreationDocument(document, "Old title"), document);
  assert.equal(creationTitleFromMarkdown(document, "Old title"), "A completely new title");
  assert.equal(creationBodyMarkdown(document), "The edited body.");
});

test("creation title extraction returns clean display text", () => {
  assert.equal(
    creationTitleFromMarkdown("# **Editable** [launch](https://example.com)\n\nBody", "Fallback"),
    "Editable launch",
  );
});

test("artifact subtitles remain part of copied and persisted creation documents", () => {
  assert.equal(
    creationDocumentFromArtifact({ title: "A clear title", subtitle: "A useful deck", content: "The complete body." }),
    "# A clear title\n\n*A useful deck*\n\nThe complete body.",
  );
  assert.equal(
    creationDocumentFromArtifact({ title: "A clear title", subtitle: "A useful deck", content: "# Authored title\n\n*A useful deck*\n\nBody" }),
    "# Authored title\n\n*A useful deck*\n\nBody",
  );
});
