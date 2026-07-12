const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMcpRpc, validateToolCall } = require('../lib/mcp-validation');

test('accepts supported MCP requests and bounded tool arguments', () => {
  const rpc = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_note', arguments: { text: 'hello' } } };
  assert.equal(validateMcpRpc(rpc), rpc);
  assert.deepEqual(validateToolCall('search_notes', { query: 'hello', limit: 10 }), { query: 'hello', limit: 10 });
  assert.deepEqual(
    validateToolCall('create_note', { text: 'hello', idempotency_key: 'msg_1' }),
    { text: 'hello', idempotency_key: 'msg_1' },
  );
});

for (const [name, rpc] of [
  ['unknown method', { method: 'roots/list' }],
  ['unknown tool', { method: 'tools/call', params: { name: 'run_shell', arguments: {} } }],
  ['oversized request', { method: 'tools/call', params: { name: 'create_note', arguments: { text: 'x'.repeat(1024 * 1024) } } }],
  ['object id', { id: {}, method: 'tools/list' }],
  ['unexpected argument', { method: 'tools/call', params: { name: 'create_note', arguments: { text: 'ok', command: 'nope' } } }],
  ['invalid confidence', { method: 'tools/call', params: { name: 'create_note_synthesized', arguments: { text: 'x', contentType: 'idea', category: 'c', annotation: 'a', confidence: 101 } } }],
  ['unsupported resource', { method: 'resources/read', params: { uri: 'file:///etc/passwd' } }],
]) test(`rejects ${name}`, () => assert.throws(() => validateMcpRpc(rpc)));

test('rejects invalid mutation values before execution', () => {
  assert.throws(() => validateToolCall('create_project', { name: '' }), /Invalid name/);
  assert.throws(() => validateToolCall('delete_note', { note_id: 42 }), /Invalid note_id/);
  assert.throws(() => validateToolCall('search_notes', { query: 'x', limit: -1 }), /Invalid limit/);
});
