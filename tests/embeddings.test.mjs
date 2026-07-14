import test from 'node:test';
import assert from 'node:assert/strict';
import relevance from '../lib/relevance-vectors.js';

const { cosineSimilarity, embedRelevanceVector } = relevance;

test('local relevance vectors are deterministic, normalized, and model-free', async () => {
  const first = embedRelevanceVector('Production readiness audit');
  const second = embedRelevanceVector('Production readiness audit');
  assert.equal(first.length, 384);
  assert.deepEqual(first, second);
  const norm = Math.sqrt(Array.from(first).reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-6);
  assert.ok(cosineSimilarity(first, second) > 0.999);
});

test('empty text produces a zero vector', async () => {
  const vector = embedRelevanceVector('   ');
  assert.equal(vector.length, 384);
  assert.equal(Array.from(vector).every(value => value === 0), true);
});
