function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function noteTitle(text) {
  const firstLine = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  return normalizeSearchText(firstLine.replace(/^#{1,6}\s*/, ""));
}

export function textSearch(query, blocks, limit = 20) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const tokens = [...new Set(normalizedQuery.split(/\s+/).filter(Boolean))];
  const scored = [];

  for (const block of blocks) {
    const normalizedText = normalizeSearchText(block.text);
    if (!normalizedText) continue;
    const title = noteTitle(block.text);
    const matchedTokens = tokens.filter((token) => normalizedText.includes(token));
    if (matchedTokens.length === 0) continue;

    const tokenCoverage = matchedTokens.length / tokens.length;
    const titleCoverage = tokens.filter((token) => title.includes(token)).length / tokens.length;
    const phraseIndex = normalizedText.indexOf(normalizedQuery);

    let score = 0.3 + tokenCoverage * 0.25 + titleCoverage * 0.25;
    if (phraseIndex >= 0) {
      const positionQuality = 1 - Math.min(1, phraseIndex / Math.max(1, normalizedText.length));
      score = Math.max(score, 0.45 + positionQuality * 0.25);
    }
    if (title === normalizedQuery) score = 1;
    else if (title.startsWith(normalizedQuery)) score = Math.max(score, 0.96);
    else if (title.includes(normalizedQuery)) score = Math.max(score, 0.9);

    scored.push({ blockId: block.id, score: Math.min(1, score) });
  }

  return scored
    .sort((left, right) => right.score - left.score || left.blockId.localeCompare(right.blockId))
    .slice(0, limit);
}

export function mergeHybridSearchResults(textResults, semanticResults) {
  const semanticById = new Map(semanticResults.map((result) => [result.blockId, result]));
  const merged = textResults.map((result) => {
    const semantic = semanticById.get(result.blockId);
    if (!semantic) return result;
    semanticById.delete(result.blockId);
    return { ...result, score: Math.min(1, result.score + Math.max(0, semantic.score) * 0.15) };
  });

  for (const semantic of semanticById.values()) {
    merged.push({ ...semantic, score: Math.min(0.5, Math.max(0, semantic.score) * 0.5) });
  }

  return merged.sort((left, right) => right.score - left.score || left.blockId.localeCompare(right.blockId));
}
