const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWorkspaceLock } = require('../lib/workspace-lock');

function withTempLock(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-workspace-lock-'));
  const filePath = path.join(directory, 'workspace.lock');
  try {
    run(filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('blocks a second live process from sharing one workspace', () => withTempLock((filePath) => {
  const first = createWorkspaceLock({ fs, filePath, pid: 101, isProcessAlive: (pid) => pid === 101 });
  const second = createWorkspaceLock({ fs, filePath, pid: 202, isProcessAlive: (pid) => pid === 101 });

  assert.deepEqual(first.acquire(), { acquired: true, ownerPid: 101 });
  assert.deepEqual(second.acquire(), { acquired: false, ownerPid: 101 });
  assert.equal(first.release(), true);
  assert.equal(fs.existsSync(filePath), false);
}));

test('reclaims a stale process lock without weakening file permissions', () => withTempLock((filePath) => {
  fs.writeFileSync(filePath, JSON.stringify({ version: 1, pid: 303, startedAt: 1 }), { mode: 0o600 });
  const current = createWorkspaceLock({ fs, filePath, pid: 404, now: () => 2, isProcessAlive: () => false });

  assert.deepEqual(current.acquire(), { acquired: true, ownerPid: 404 });
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).pid, 404);
  assert.equal(current.release(), true);
}));

test('does not release a lock owned by another process', () => withTempLock((filePath) => {
  const owner = createWorkspaceLock({ fs, filePath, pid: 505, isProcessAlive: () => true });
  const other = createWorkspaceLock({ fs, filePath, pid: 606, isProcessAlive: () => true });

  owner.acquire();
  assert.equal(other.release(), false);
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(owner.release(), true);
}));
