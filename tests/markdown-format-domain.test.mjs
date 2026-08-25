import test from "node:test";
import assert from "node:assert/strict";
import { cleanFormattedMarkdown, markdownFormatSystemPrompt } from "../lib/markdown-format-domain.mjs";

test("normalizes provider markup wrapped around Markdown headings", () => {
  const result = cleanFormattedMarkdown(`\`\`\`markdown
**<u>## Structural Patterns</u>**

**<u>### 1. The Loop</u>**
Keep **ordinary emphasis** intact.
\`\`\``);

  assert.equal(result, "## Structural Patterns\n\n### 1. The Loop\nKeep **ordinary emphasis** intact.");
});

test("preserves code content while cleaning surrounding prose", () => {
  const result = cleanFormattedMarkdown("**<u>## Example</u>**\n\n```html\n<u>literal code</u>\n```\n");

  assert.equal(result, "## Example\n\n```html\n<u>literal code</u>\n```");
});

test("format prompt rejects HTML and wrapped heading syntax", () => {
  const prompt = markdownFormatSystemPrompt("Organize the document.", "document");

  assert.match(prompt, /do not emit HTML formatting tags/i);
  assert.match(prompt, /never wrap headings/i);
});
