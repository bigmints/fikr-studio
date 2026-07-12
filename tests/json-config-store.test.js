const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { updateJsonConfig } = require('../lib/json-config-store');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-config-'));
  const filePath = path.join(root, 'client', 'config.json');
  return { root, filePath };
}

test('atomically preserves existing settings and restricts token-bearing config permissions', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(f.filePath));
  fs.writeFileSync(f.filePath, JSON.stringify({ theme: 'dark', mcpServers: { other: { url: 'local' } } }));

  updateJsonConfig({
    fs,
    filePath: f.filePath,
    pid: 42,
    mutate(config) {
      config.mcpServers.fikr = { url: 'http://localhost/?token=redacted' };
      return config;
    },
  });

  const saved = JSON.parse(fs.readFileSync(f.filePath, 'utf8'));
  assert.equal(saved.theme, 'dark');
  assert.deepEqual(saved.mcpServers.other, { url: 'local' });
  assert.equal(saved.mcpServers.fikr.url, 'http://localhost/?token=redacted');
  assert.equal(fs.statSync(f.filePath).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(path.dirname(f.filePath), '.config.json.42.tmp')), false);
});

test('refuses to replace malformed existing configuration', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(f.filePath));
  fs.writeFileSync(f.filePath, '{not-json');

  assert.throws(() => updateJsonConfig({ fs, filePath: f.filePath, mutate: () => ({}) }));
  assert.equal(fs.readFileSync(f.filePath, 'utf8'), '{not-json');
});

test('removes temporary data and preserves the original when replacement fails', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(f.filePath));
  fs.writeFileSync(f.filePath, JSON.stringify({ keep: true }));
  const failingFs = { ...fs, renameSync() { throw new Error('simulated rename failure'); } };

  assert.throws(() => updateJsonConfig({
    fs: failingFs,
    filePath: f.filePath,
    pid: 43,
    mutate: config => ({ ...config, changed: true }),
  }));
  assert.deepEqual(JSON.parse(fs.readFileSync(f.filePath, 'utf8')), { keep: true });
  assert.equal(fs.existsSync(path.join(path.dirname(f.filePath), '.config.json.43.tmp')), false);
});
