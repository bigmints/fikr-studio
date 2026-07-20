const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadOrCreateLocalMcpAuthToken } = require('../lib/local-mcp-auth');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-mcp-auth-'));
  return {
    root,
    filePath: path.join(root, 'profile', 'mcp-auth.json'),
  };
}

test('creates and reuses a permission-restricted disposable MCP token', () => {
  const f = fixture();
  try {
    let generated = 0;
    const randomBytes = () => {
      generated += 1;
      return Buffer.from('ab'.repeat(32), 'hex');
    };

    const first = loadOrCreateLocalMcpAuthToken({ fs, filePath: f.filePath, randomBytes, pid: 41 });
    const second = loadOrCreateLocalMcpAuthToken({ fs, filePath: f.filePath, randomBytes, pid: 42 });

    assert.equal(first, 'ab'.repeat(32));
    assert.equal(second, first);
    assert.equal(generated, 1);
    assert.equal(fs.statSync(f.filePath).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.filePath, 'utf8')), { version: 1, token: first });
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('rotates malformed state without reading the legacy Keychain ciphertext file', () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.dirname(f.filePath), { recursive: true });
    fs.writeFileSync(f.filePath, '{broken');
    fs.writeFileSync(path.join(path.dirname(f.filePath), 'mcp-auth.secure'), 'legacy-ciphertext');

    const token = loadOrCreateLocalMcpAuthToken({
      fs,
      filePath: f.filePath,
      randomBytes: () => Buffer.from('cd'.repeat(32), 'hex'),
      pid: 43,
    });

    assert.equal(token, 'cd'.repeat(32));
    assert.deepEqual(JSON.parse(fs.readFileSync(f.filePath, 'utf8')), { version: 1, token });
    assert.equal(fs.readFileSync(path.join(path.dirname(f.filePath), 'mcp-auth.secure'), 'utf8'), 'legacy-ciphertext');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
