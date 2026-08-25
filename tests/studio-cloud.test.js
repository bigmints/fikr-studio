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

test('rotates the relay key through an authenticated POST', async () => {
  let captured;
  const client = createStudioCloudClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ relayApiKey: 'rotated' }), { status: 200 });
    },
  });
  assert.deepEqual(await client.rotateRelayKey('token'), { relayApiKey: 'rotated' });
  assert.equal(captured.url, 'https://example.test/api/mcp/keys');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.Authorization, 'Bearer token');
});

test('loads the read-only billing summary with the authenticated account token', async () => {
  let captured;
  const summary = {
    plan: 'pro',
    nextPayment: { amount: 1499, currency: 'usd', date: '2026-09-24T00:00:00.000Z' },
    paymentMethod: { type: 'card', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
    invoices: [],
    stripeAvailable: true,
  };
  const client = createStudioCloudClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify(summary), { status: 200 });
    },
  });

  assert.deepEqual(await client.getBillingSummary('id-token'), summary);
  assert.equal(captured.url, 'https://example.test/api/billing/summary');
  assert.equal(captured.options.headers.Authorization, 'Bearer id-token');
});
