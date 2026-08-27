import { normalizeDisplayMarkdown } from "./display-markdown.mjs";

function firstContentLine(lines) {
  return lines.findIndex((line) => line.trim().length > 0);
}

function headingText(line) {
  const match = line.match(/^\s*#\s+(.+?)\s*#*\s*$/);
  if (!match) return "";
  return match[1]
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function creationTitleFromMarkdown(markdown, fallback = "Untitled creation") {
  const normalized = normalizeDisplayMarkdown(markdown);
  const lines = normalized.split("\n");
  const firstLine = firstContentLine(lines);
  const title = firstLine >= 0 ? headingText(lines[firstLine]) : "";
  return title || String(fallback ?? "").trim().slice(0, 240) || "Untitled creation";
}

export function ensureCreationDocument(markdown, fallbackTitle = "Untitled creation") {
  const normalized = normalizeDisplayMarkdown(markdown);
  const lines = normalized.split("\n");
  const firstLine = firstContentLine(lines);
  if (firstLine >= 0 && headingText(lines[firstLine])) return normalized;

  const title = String(fallbackTitle ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240) || "Untitled creation";
  return normalized ? `# ${title}\n\n${normalized}` : `# ${title}`;
}

export function creationBodyMarkdown(markdown) {
  const normalized = normalizeDisplayMarkdown(markdown);
  const lines = normalized.split("\n");
  const firstLine = firstContentLine(lines);
  if (firstLine < 0 || !headingText(lines[firstLine])) return normalized;

  lines.splice(firstLine, 1);
  if (lines[firstLine]?.trim() === "") lines.splice(firstLine, 1);
  return lines.join("\n").trim();
}

export function creationDocumentFromArtifact(artifact) {
  const document = ensureCreationDocument(artifact?.content ?? "", artifact?.title);
  const subtitle = String(artifact?.subtitle ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  if (!subtitle || document.toLowerCase().includes(subtitle.toLowerCase())) return document;

  const lines = document.split("\n");
  const firstLine = firstContentLine(lines);
  if (firstLine < 0 || !headingText(lines[firstLine])) return document;
  lines.splice(firstLine + 1, 0, "", `*${subtitle}*`);
  return lines.join("\n").trim();
}
