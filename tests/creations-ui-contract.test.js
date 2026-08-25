const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('creation title belongs to the document body instead of the app toolbar', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'creations-page.tsx'), 'utf8');
  const detailToolbar = component.match(/<header[^>]*data-testid="creation-toolbar"[\s\S]*?<\/header>/)?.[0] ?? '';
  const documentHeader = component.match(/<header[^>]*data-testid="creation-document-header"[\s\S]*?<\/header>/)?.[0] ?? '';

  assert.notEqual(detailToolbar, '');
  assert.notEqual(documentHeader, '');
  assert.doesNotMatch(detailToolbar, /<h[1-6][^>]*>[\s\S]*selected\.name/);
  assert.match(documentHeader, /selected\.name/);
});
