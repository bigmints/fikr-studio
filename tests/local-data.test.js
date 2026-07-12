const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { clearLocalFiles } = require('../lib/local-data');

test('reports cleared only after every targeted local workspace file is absent', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-clear-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const files = [path.join(directory, 'workspace.json'), path.join(directory, 'workspace.backup.json')];
  for (const file of files) fs.writeFileSync(file, '{}');
  const result = clearLocalFiles(fs, files);
  assert.equal(result.cleared, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.remaining, []);
});

test('never claims a partial deletion succeeded', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-clear-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const primary = path.join(directory, 'workspace.json');
  const backup = path.join(directory, 'workspace.backup.json');
  fs.writeFileSync(primary, '{}');
  fs.writeFileSync(backup, '{}');
  const failingFs = { ...fs, unlinkSync(file) {
    if (file === backup) throw new Error('simulated permission failure');
    return fs.unlinkSync(file);
  } };
  const result = clearLocalFiles(failingFs, [primary, backup]);
  assert.equal(result.cleared, false);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.remaining, [backup]);
});
