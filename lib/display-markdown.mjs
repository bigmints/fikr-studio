function isFence(line) {
  return line.match(/^\s*(`{3,}|~{3,})([\w-]*)\s*[.!?,;:]?\s*$/);
}

function looksLikeMarkdownDocument(value) {
  return /(^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|.+\|)/m.test(value);
}

function normalizeCitationMarkers(markdown) {
  let fence = null;
  return markdown.split("\n").map((line) => {
    const marker = isFence(line);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      return line;
    }
    return fence ? line : line.replace(/\[#(\d+)\]/g, "[$1]");
  }).join("\n");
}

/**
 * Repairs provider-shaped Markdown for display without rewriting authored text.
 * It only normalizes fence punctuation and unwraps a whole-document Markdown
 * fence, leaving real code blocks and inline content untouched.
 */
export function normalizeDisplayMarkdown(markdown = "") {
  const normalized = String(markdown)
    .replace(/\r\n?/g, "\n")
    .replace(/([^\n])\s+(```+|~~~+)[.!?,;:]?(?=\s*(?:\n|$))/g, "$1\n$2")
    .replace(/^(```+|~~~+)[.!?,;:]\s*$/gm, "$1")
    .trim();

  if (!normalized) return "";

  const lines = normalized.split("\n");
  const opening = isFence(lines[0]);
  const closing = lines.length > 1 ? isFence(lines.at(-1) ?? "") : null;
  if (!opening || !closing || opening[1][0] !== closing[1][0]) return normalizeCitationMarkers(normalized);

  const language = opening[2].toLowerCase();
  const inner = lines.slice(1, -1).join("\n").trim();
  const isMarkdownFence = language === "md" || language === "markdown" || language === "mdown";
  const isUnlabelledMarkdown = !language && looksLikeMarkdownDocument(inner);

  return normalizeCitationMarkers(isMarkdownFence || isUnlabelledMarkdown ? inner : normalized);
}
