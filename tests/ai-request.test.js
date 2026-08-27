const test = require('node:test');
const assert = require('node:assert/strict');
const { performAiRequest, validateAiRequest, verifyAiKey } = require('../lib/ai-request');

test('allows only fixed providers, bounded JSON, and a concrete model', () => {
  assert.deepEqual(validateAiRequest('openai', { model: 'gpt-test', messages: [] }), { model: 'gpt-test', messages: [] });
  assert.throws(() => validateAiRequest('custom', { model: 'x' }), /Unsupported/);
  assert.throws(() => validateAiRequest('openai', { messages: [] }), /model/);
  assert.throws(() => validateAiRequest('openai', { model: 'x', input: 'a'.repeat(1024 * 1024) }), /1 MB/);
});

test('injects the stored key only in the main-process provider request', async () => {
  let captured;
  const result = await performAiRequest({
    provider: 'openrouter',
    body: { model: 'test/model', messages: [] },
    apiKey: 'secret-key',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, text: async () => '{"choices":[]}' };
    },
  });
  assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-key');
  assert.equal(captured.options.headers['HTTP-Referer'], 'https://fikr.one');
  assert.deepEqual(result, { ok: true, status: 200, body: '{"choices":[]}' });
});

test('rejects missing keys and oversized responses', async () => {
  await assert.rejects(() => performAiRequest({ provider: 'openai', body: { model: 'x' }, apiKey: '' }), /No API key/);
  await assert.rejects(() => performAiRequest({
    provider: 'openai', body: { model: 'x' }, apiKey: 'key',
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'x'.repeat(5 * 1024 * 1024 + 1) }),
  }), /5 MB/);
});

test('verifies provider keys with a bounded read-only request', async () => {
  let captured;
  const result = await verifyAiKey({
    provider: 'openrouter',
    apiKey: '  secret-key  ',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, text: async () => '{"data":{"label":"Fikr"}}' };
    },
  });

  assert.equal(captured.url, 'https://openrouter.ai/api/v1/auth/key');
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-key');
  assert.deepEqual(result, { ok: true, status: 200 });
});

test('does not treat a rejected provider key as verified', async () => {
  const result = await verifyAiKey({
    provider: 'openai',
    apiKey: 'bad-key',
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => '{"error":"invalid_api_key"}' }),
  });

  assert.deepEqual(result, { ok: false, status: 401 });
  await assert.rejects(() => verifyAiKey({ provider: 'custom', apiKey: 'key' }), /Unsupported/);
});
