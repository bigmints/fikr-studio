function stripOuterFence(value) {
  const normalized = String(value ?? "").trim();
  const lines = normalized.split("\n");
  if (/^```(?:markdown|md)?\s*$/i.test(lines[0] ?? "") && /^```\s*$/.test(lines.at(-1) ?? "")) {
    return lines.slice(1, -1).join("\n").trim();
  }
  return normalized;
}

/**
 * Models occasionally wrap Markdown control syntax in presentational HTML or
 * emphasis, producing source such as `**<u>## Heading**</u>`. Normalize those
 * wrappers outside code fences while preserving the document's words.
 */
export function cleanFormattedMarkdown(value) {
  const lines = stripOuterFence(value).split("\n");
  let fence = null;

  return lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? null : (fence ?? marker);
      return line;
    }
    if (fence) return line;

    const withoutPresentationTags = line.replace(/<\/?(?:u|b|strong|em|i)(?:\s[^>]*)?>/gi, "");
    const heading = withoutPresentationTags.trim().match(/^(?:\*{1,3}|_{1,3})?(#{1,6})\s+(.+?)(?:\*{1,3}|_{1,3})?$/);
    if (!heading) return withoutPresentationTags;
    return `${heading[1]} ${heading[2].trim()}`;
  }).join("\n").trim();
}

export function markdownFormatSystemPrompt(modeInstruction, scope) {
  return `You are a precise Markdown editor. ${modeInstruction}

Rules:
- Return only valid Markdown. Never add a preamble, explanation, or enclosing code fence.
- Never paraphrase or rewrite the supplied sentences.
- Preserve YAML frontmatter when present.
- Preserve code content exactly; only repair the surrounding fence when needed.
- Preserve URLs, citations, task completion states, and table data.
- Use Markdown syntax only; do not emit HTML formatting tags.
- Put heading markers at the beginning of the line and never wrap headings in bold, italics, or underline markup.
- ${scope === "selection" ? "Format only the supplied selection so it can be inserted back into the surrounding document." : "Return the complete formatted document."}`;
}
