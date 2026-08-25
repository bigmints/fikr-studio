const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('empty chat history removes the recent chats context panel', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');

  assert.match(component, /contextKind === "chats" && sortedThreads\.length > 0/);
  assert.equal((component.match(/contextKind && showContextPanel &&/g) ?? []).length, 2);
  assert.doesNotMatch(component, /Your recent conversations will appear here/);
});
