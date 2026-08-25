const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'was',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
]);

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

function searchStoredNotes({ query, projects, queryEmbedding, cosineSimilarity, limit = 10 }) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokens(query);
  if (!normalizedQuery || !Array.isArray(projects) || projects.length === 0) return [];

  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const ranked = [];
  for (const project of projects) {
    for (const note of project.blocks || []) {
      if (!note?.id || !note?.text) continue;
      const haystack = normalize([
        note.title,
        note.text,
        note.annotation,
        note.category,
        note.contentType,
      ].filter(Boolean).join(' '));
      const exact = haystack.includes(normalizedQuery);
      const tokenMatches = queryTokens.filter((token) => haystack.includes(token)).length;
      const lexicalCoverage = queryTokens.length > 0 ? tokenMatches / queryTokens.length : 0;
      const semantic = queryEmbedding && note.embedding
        ? Math.max(0, Number(cosineSimilarity(queryEmbedding, note.embedding)) || 0)
        : 0;

      if (!exact && lexicalCoverage < 0.5 && semantic <= 0.2) continue;
      ranked.push({
        exact,
        lexicalCoverage,
        semantic,
        project: project.name,
        project_id: project.id,
        id: note.id,
        text: note.text,
        type: note.contentType,
        annotation: note.annotation,
      });
    }
  }

  return ranked
    .sort((left, right) => Number(right.exact) - Number(left.exact)
      || right.lexicalCoverage - left.lexicalCoverage
      || right.semantic - left.semantic
      || String(left.id).localeCompare(String(right.id)))
    .slice(0, boundedLimit)
    .map(({ exact: _exact, lexicalCoverage: _lexicalCoverage, semantic, ...result }) => ({
      ...result,
      similarity: Math.round(semantic * 100) / 100,
    }));
}

module.exports = { searchStoredNotes };
