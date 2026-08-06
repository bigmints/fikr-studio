export const MARKDOWN_ENTRY_DRAFT_PREFIX = "fikr-markdown-entry-draft-v1";

const STRUCTURED_MARKDOWN = [
  /(^|\n)\s{0,3}#{1,6}\s+\S/,
  /(^|\n)\s{0,3}(?:[-+*]|\d+[.)])\s+\S/,
  /(^|\n)\s{0,3}>\s+\S/,
  /(^|\n)\s{0,3}[-+*]\s+\[[ xX]\]\s+\S/,
  /(^|\n)\s{0,3}```[\s\S]*```/,
  /(^|\n)\s{0,3}(?:---+|___+|\*\*\*+)\s*(?:\n|$)/,
  /(^|\n)\s*\|.+\|\s*\n\s*\|?\s*:?-{3,}/,
  /\[[^\]\n]+\]\([^\s)]+(?:\s+"[^"]*")?\)/,
  /(?:\*\*|__|~~)[^\n]+(?:\*\*|__|~~)/,
  /`[^`\n]+`/,
];

/**
 * Expand only when a paste benefits from a document editor. Ordinary words,
 * URLs, and short sentences keep the quick-capture interaction lightweight.
 */
export function shouldExpandMarkdownPaste(text) {
  if (typeof text !== "string") return false;
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return false;

  const newlineCount = (normalized.match(/\n/g) || []).length;
  if (newlineCount >= 2) return true;
  if (normalized.length >= 250 && newlineCount >= 1) return true;
  return STRUCTURED_MARKDOWN.some((pattern) => pattern.test(normalized));
}

export function markdownEntryDraftKey(projectId) {
  return `${MARKDOWN_ENTRY_DRAFT_PREFIX}:${projectId || "default"}`;
}

export function insertAtSelection(value, inserted, start, end) {
  const safeStart = Math.max(0, Math.min(start ?? value.length, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end ?? safeStart, value.length));
  const normalized = inserted.replace(/\r\n?/g, "\n");
  const nextValue = value.slice(0, safeStart) + normalized + value.slice(safeEnd);
  const cursor = safeStart + normalized.length;
  return { value: nextValue, cursor };
}

const FENCED_CODE_BLOCK = /(```[^\n]*\n[\s\S]*?\n```|~~~[^\n]*\n[\s\S]*?\n~~~)/g;

/**
 * Tiptap's inline-code mark excludes every other mark. Markdown parsers can
 * still produce nested combinations such as **`code`**, which ProseMirror
 * rejects before the editor can render. Keep code authoritative at the rich
 * editor boundary by removing only emphasis wrappers that contain inline code.
 * Fenced code blocks are returned byte-for-byte unchanged.
 */
export function normalizeMarkdownForRichEditor(markdown) {
  if (typeof markdown !== "string" || !markdown.includes("`")) return markdown;

  return markdown
    .split(FENCED_CODE_BLOCK)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;

      let normalized = segment;
      const conflictingWrappers = [
        /\*\*([^\n]*?`[^\n`]+`[^\n]*?)\*\*/g,
        /__([^\n]*?`[^\n`]+`[^\n]*?)__/g,
        /~~([^\n]*?`[^\n`]+`[^\n]*?)~~/g,
        /\*([^*\n]*?`[^\n`]+`[^*\n]*?)\*/g,
        /_([^_\n]*?`[^\n`]+`[^_\n]*?)_/g,
      ];

      // Triple emphasis unwraps in more than one pass.
      for (let pass = 0; pass < 3; pass += 1) {
        const before = normalized;
        for (const wrapper of conflictingWrappers) {
          normalized = normalized.replace(wrapper, "$1");
        }
        if (normalized === before) break;
      }
      return normalized;
    })
    .join("");
}
