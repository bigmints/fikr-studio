const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_TEXT_EXPORT_BYTES, normalizeBase64Export, normalizeTextExport } = require('../lib/file-export');

test('normalizes bounded text export requests', () => {
  assert.deepEqual(normalizeTextExport({ filename: ' Workspace.fikrdata ', content: '{"ok":true}' }), {
    filename: 'Workspace.fikrdata',
    content: '{"ok":true}',
    extension: 'fikrdata',
  });
  assert.equal(normalizeTextExport({ filename: 'note.MD', content: '# Note' }).extension, 'md');
});

test('normalizes bounded PNG exports and rejects unsafe binary payloads', () => {
  const png = normalizeBase64Export({ filename: ' cover.png ', base64: Buffer.from('png').toString('base64') });
  assert.equal(png.filename, 'cover.png');
  assert.equal(png.content.toString('utf8'), 'png');
  assert.throws(() => normalizeBase64Export({ filename: '../cover.png', base64: 'cG5n' }), /Invalid/);
  assert.throws(() => normalizeBase64Export({ filename: 'cover.jpg', base64: 'cG5n' }), /Invalid/);
  assert.throws(() => normalizeBase64Export({ filename: 'cover.png', base64: 'not base64' }), /Invalid/);
});

test('rejects path traversal, unsupported extensions, and oversized exports', () => {
  for (const filename of ['../workspace.fikrdata', 'folder/note.md', 'note.exe', 'note']) {
    assert.throws(() => normalizeTextExport({ filename, content: 'x' }), /Invalid export request/);
  }
  assert.throws(
    () => normalizeTextExport({ filename: 'large.txt', content: 'x'.repeat(MAX_TEXT_EXPORT_BYTES + 1) }),
    /exceeds 32 MB/,
  );
});
