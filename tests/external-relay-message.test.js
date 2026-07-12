const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_NOTE_TEXT,
  extractMessageText,
  externalRelayMessageToRpc,
} = require('../lib/external-relay-message');

test('extracts common webhook text fields and preserves raw JSON as a fallback', () => {
  assert.equal(extractMessageText({ text: 'hello' }), 'hello');
  assert.equal(extractMessageText({ message: 'from webhook' }), 'from webhook');
  assert.match(extractMessageText({ event: 'push', count: 2 }), /"event": "push"/);
});

test('builds a bounded create_note call for Studio', () => {
  const rpc = externalRelayMessageToRpc({
    id: 'msg_1',
    leaseToken: 'lease_1',
    defaultProjectId: 'project_1',
    payload: { content: 'New external idea' },
  });
  assert.deepEqual(rpc.params, {
    name: 'create_note',
    arguments: { text: 'New external idea', project_id: 'project_1', idempotency_key: 'msg_1' },
  });
  assert.equal(extractMessageText('x'.repeat(MAX_NOTE_TEXT + 10)).endsWith('[External message truncated]'), true);
});

test('rejects messages without a valid lease identity', () => {
  assert.throws(() => externalRelayMessageToRpc({ payload: 'hello' }), /lease/);
});
