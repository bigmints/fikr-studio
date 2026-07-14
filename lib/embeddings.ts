/**
 * Deterministic local relevance vectors.
 *
 * This intentionally uses no downloaded model or native runtime. Tokens,
 * adjacent-token pairs, and character trigrams are projected into a normalized
 * 384-dimensional feature vector. It provides fast offline lexical relevance
 * while Plus/Pro server search remains the semantic-search path.
 */

import { cosineSimilarity as compareVectors, embedRelevanceVector } from "./relevance-vectors"

export function isModelLoaded(): boolean {
  return true
}

export async function getModelLoaded(): Promise<void> {
  // Kept for API compatibility with search UI startup; no model is downloaded.
}

export async function embedText(text: string): Promise<Float32Array> {
  return embedRelevanceVector(text)
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  return Promise.all(texts.map(embedText))
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  return compareVectors(a, b)
}
