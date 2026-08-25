const test = require('node:test');
const assert = require('node:assert/strict');
const { searchStoredNotes } = require('../lib/mcp-search');

const project = {
  id: 'xtara',
  name: 'Xtara',
  blocks: [
    {
      id: 'vision',
      title: 'Xtara Product Vision',
      text: 'A trusted career navigation system for learners.',
      embedding: [0, 1],
    },
    {
      id: 'semantic-distractor',
      text: 'Unrelated content with a high vector score.',
      embedding: [1, 0],
    },
  ],
};

const cosineSimilarity = (left, right) => left[0] * right[0] + left[1] * right[1];

test('exact lexical matches outrank stronger unrelated vector matches', () => {
  const results = searchStoredNotes({
    query: 'Xtara Product Vision',
    projects: [project],
    queryEmbedding: [1, 0],
    cosineSimilarity,
    limit: 5,
  });

  assert.equal(results[0].id, 'vision');
  assert.equal(results[1].id, 'semantic-distractor');
});

test('keyword search still works when notes have no embeddings', () => {
  const results = searchStoredNotes({
    query: 'career learners',
    projects: [{ ...project, blocks: [{ ...project.blocks[0], embedding: undefined }] }],
    queryEmbedding: [1, 0],
    cosineSimilarity,
  });

  assert.deepEqual(results.map((result) => result.id), ['vision']);
});

test('project scoping is preserved by the caller supplied project list', () => {
  const results = searchStoredNotes({
    query: 'Xtara Product Vision',
    projects: [],
    queryEmbedding: [1, 0],
    cosineSimilarity,
  });

  assert.deepEqual(results, []);
});
