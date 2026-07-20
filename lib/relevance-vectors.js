const DIMENSIONS = 384;

function hashFeature(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function relevanceFeatures(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const result = [...tokens];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    result.push(`${tokens[index]}_${tokens[index + 1]}`);
  }
  for (const token of tokens) {
    if (token.length < 4) continue;
    for (let index = 0; index <= token.length - 3; index += 1) {
      result.push(`~${token.slice(index, index + 3)}`);
    }
  }
  return result;
}

function embedRelevanceVector(text) {
  const vector = new Float32Array(DIMENSIONS);
  for (const feature of relevanceFeatures(text)) {
    const hash = hashFeature(feature);
    vector[hash % DIMENSIONS] += (hash & 0x80000000) === 0 ? 1 : -1;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  }
  return vector;
}

function cosineSimilarity(a, b) {
  let sum = 0;
  const length = Math.min(a?.length || 0, b?.length || 0);
  for (let index = 0; index < length; index += 1) sum += a[index] * b[index];
  return sum;
}

module.exports = { DIMENSIONS, cosineSimilarity, embedRelevanceVector, relevanceFeatures };
