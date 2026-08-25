import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDisplayMarkdown } from "../lib/display-markdown.mjs";

test("unwraps a provider fence around a Markdown document", () => {
  assert.equal(
    normalizeDisplayMarkdown("```markdown\n# Heading\n\n- one\n- two\n```"),
    "# Heading\n\n- one\n- two",
  );
  assert.equal(normalizeDisplayMarkdown("```\n# Heading\n\nBody\n```"), "# Heading\n\nBody");
});

test("preserves real fenced code", () => {
  const source = "```js\nconsole.log('hello')\n```";
  assert.equal(normalizeDisplayMarkdown(source), source);
});

test("repairs punctuation and inline text before closing fences", () => {
  assert.equal(
    normalizeDisplayMarkdown("Before\n\n```txt\nvalue\n```.") ,
    "Before\n\n```txt\nvalue\n```",
  );
});

test("normalizes provider citation markers without changing their number", () => {
  assert.equal(normalizeDisplayMarkdown("Supported claim [#3]."), "Supported claim [3].");
  assert.equal(normalizeDisplayMarkdown("```txt\n[#3]\n```"), "```txt\n[#3]\n```");
});
