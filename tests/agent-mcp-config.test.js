const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAgentMcpConfigStore } = require('../lib/agent-mcp-config');

test('persists only validated, explicitly allowlisted MCP connections', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-agent-mcp-'));
  const filePath = path.join(directory, 'connections.json');
  const store = createAgentMcpConfigStore(filePath);

  const saved = store.upsert({
    name: 'research',
    url: 'https://mcp.example.com/mcp',
    transport: 'streamable-http',
    allowedTools: ['search', 'fetch'],
    enabled: true,
  });

  assert.equal(saved.name, 'research');
  assert.deepEqual(store.list(), [saved]);
  assert.throws(
    () => store.upsert({ name: 'unsafe', url: 'http://example.com/mcp', allowedTools: ['search'] }),
    /HTTPS or a loopback HTTP URL/,
  );
  assert.throws(
    () => store.upsert({ name: 'no-tools', url: 'https://mcp.example.com/mcp', allowedTools: [] }),
    /explicit tool allowlist/,
  );

  assert.equal(store.remove('research'), true);
  assert.deepEqual(store.list(), []);
});

test('fails closed when the MCP connection file is malformed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-agent-mcp-'));
  const filePath = path.join(directory, 'connections.json');
  fs.writeFileSync(filePath, '{broken', 'utf8');
  const store = createAgentMcpConfigStore(filePath);

  assert.deepEqual(store.list(), []);
});

test('stores local MCP private config but omits it from renderer-safe listings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fikr-agent-mcp-'));
  const filePath = path.join(directory, 'connections.json');
  const store = createAgentMcpConfigStore(filePath);

  store.upsert({
    name: 'files',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { ACCESS_TOKEN: 'private-token' },
    allowedTools: ['read_file'],
    enabled: true,
  });

  assert.equal(store.list()[0].env.ACCESS_TOKEN, 'private-token');
  assert.equal(store.listSafe()[0].env, undefined);
  assert.equal(store.listSafe()[0].hasPrivateConfig, true);

  store.setEnabled('files', false);
  assert.equal(store.list()[0].enabled, false);
  assert.equal(store.list()[0].env.ACCESS_TOKEN, 'private-token');
});
