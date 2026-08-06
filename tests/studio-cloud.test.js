const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudioCloudClient } = require('../lib/studio-cloud');

test('requires authentication before any network request', async () => {
  let called = false;
  const client = createStudioCloudClient({ fetchImpl: async () => { called = true; } });
  await assert.rejects(client.loadWorkspace(''), /Authentication required/);
  assert.equal(called, false);
});

test('sends only the bearer token and returns workspace initialization state', async () => {
  let captured;
  const client = createStudioCloudClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ workspace: { projects: [] }, initialized: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(await client.loadWorkspace('id-token'), { projects: [] });
  assert.deepEqual(await client.loadWorkspaceState('id-token'), { workspace: { projects: [] }, initialized: true });
  assert.equal(captured.url, 'https://example.test/api/studio/workspace');
  assert.equal(captured.options.headers.Authorization, 'Bearer id-token');
});

test('serializes deletion baselines and surfaces API errors', async () => {
  let body;
  const client = createStudioCloudClient({
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  await client.saveWorkspace('token', { projects: [] }, new Set(['n']), new Set(['p']), new Set(['g']));
  assert.deepEqual(body.baseline, { noteIds: ['n'], projectIds: ['p'], genProjectIds: ['g'] });

  const failing = createStudioCloudClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: 'Plan required' }), { status: 403 }),
  });
  await assert.rejects(failing.loadWorkspace('token'), error => {
    assert.equal(error.message, 'Plan required');
    assert.equal(error.status, 403);
    return true;
  });
});

test('acknowledges the legacy remote MCP queue with its lease token', async () => {
  let captured;
  const client = createStudioCloudClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ acknowledged: true }), { status: 200 });
    },
  });
  await client.acknowledgeRelay('token', 'request_1', 'lease_1', { status: 'completed', result: { ok: true } });
  assert.equal(captured.url, 'https://example.test/api/studio/relay');
  assert.deepEqual(JSON.parse(captured.options.body), {
    id: 'request_1',
    leaseToken: 'lease_1',
    status: 'completed',
    result: { ok: true },
  });
});

test('leases and acknowledges external relay messages through short authenticated requests', async () => {
  const calls = [];
  const client = createStudioCloudClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    },
  });
  await client.leaseExternalMessages('token', 3);
  await client.acknowledgeExternalMessage('token', 'msg_1', 'lease_1', { ok: true });
  await client.rejectExternalMessage('token', 'msg_2', 'lease_2', 'failed');

  assert.equal(calls[0].url, 'https://example.test/api/relay/v1/messages/lease');
  assert.deepEqual(JSON.parse(calls[0].options.body), { limit: 3 });
  assert.match(calls[1].url, /\/messages\/msg_1\/ack$/);
  assert.deepEqual(JSON.parse(calls[1].options.body), { leaseToken: 'lease_1', result: { ok: true } });
  assert.match(calls[2].url, /\/messages\/msg_2\/nack$/);
});
