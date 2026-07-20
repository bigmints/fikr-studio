const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWorkspaceStore } = require('../lib/workspace-store');

function fixture(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-workspace-'));
  const primaryFile = path.join(directory, 'workspace.json');
  const backupFile = path.join(directory, 'workspace.backup.json');
  const logger = { error() {}, warn() {} };
  const store = createWorkspaceStore({ fs, directory, primaryFile, backupFile, logger, pid: 42, ...overrides });
  return { directory, primaryFile, backupFile, store };
}

test('atomically saves with restrictive permissions and recovers the last valid backup', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.directory, { recursive: true, force: true }));
  assert.equal(f.store.save({ version: 1 }), true);
  assert.equal(fs.statSync(f.directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(f.primaryFile).mode & 0o777, 0o600);

  assert.equal(f.store.save({ version: 2 }), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.backupFile, 'utf8')), { version: 1 });
  fs.writeFileSync(f.primaryFile, '{corrupt');
  assert.deepEqual(f.store.load(), { version: 1 });
  assert.equal(fs.existsSync(path.join(f.directory, 'workspace.json.42.tmp')), false);
});

test('keeps the primary file intact and removes temp data when rename fails', t => {
  const base = fixture();
  t.after(() => fs.rmSync(base.directory, { recursive: true, force: true }));
  assert.equal(base.store.save({ version: 1 }), true);
  const failingFs = { ...fs, renameSync() { throw new Error('simulated rename failure'); } };
  const failed = createWorkspaceStore({
    fs: failingFs,
    directory: base.directory,
    primaryFile: base.primaryFile,
    backupFile: base.backupFile,
    logger: { error() {}, warn() {} },
    pid: 43,
  });
  assert.equal(failed.save({ version: 2 }), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(base.primaryFile, 'utf8')), { version: 1 });
  assert.equal(fs.existsSync(path.join(base.directory, 'workspace.json.43.tmp')), false);
});
