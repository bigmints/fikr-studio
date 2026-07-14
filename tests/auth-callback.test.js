const test = require('node:test');
const assert = require('node:assert/strict');
const { consumeAuthCallback } = require('../lib/auth-callback');

test('accepts one exact, unexpired auth callback', () => {
  const result = consumeAuthCallback(
    'fikr-studio://auth/callback?state=expected&token=firebase-token',
    'expected',
    2_000,
    1_000,
  );
  assert.deepEqual(result, { accepted: true, token: 'firebase-token' });
});

test('accepts the exact one-shot development loopback callback', () => {
  const callback = 'http://127.0.0.1:43127/auth/callback';
  const result = consumeAuthCallback(
    `${callback}?state=expected&token=firebase-token`,
    'expected',
    2_000,
    1_000,
    callback,
  );
  assert.deepEqual(result, { accepted: true, token: 'firebase-token' });
});

test('rejects a loopback callback on the wrong port', () => {
  assert.equal(consumeAuthCallback(
    'http://127.0.0.1:43128/auth/callback?state=expected&token=t',
    'expected',
    2_000,
    1_000,
    'http://127.0.0.1:43127/auth/callback',
  ).accepted, false);
});

for (const [name, url, state, expiry, now] of [
  ['wrong state', 'fikr-studio://auth/callback?state=wrong&token=t', 'expected', 2_000, 1_000],
  ['expired state', 'fikr-studio://auth/callback?state=expected&token=t', 'expected', 1_000, 1_000],
  ['wrong origin', 'https://auth/callback?state=expected&token=t', 'expected', 2_000, 1_000],
  ['wrong path', 'fikr-studio://auth/other?state=expected&token=t', 'expected', 2_000, 1_000],
  ['duplicate state', 'fikr-studio://auth/callback?state=expected&state=expected&token=t', 'expected', 2_000, 1_000],
  ['duplicate token', 'fikr-studio://auth/callback?state=expected&token=t&token=t2', 'expected', 2_000, 1_000],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(consumeAuthCallback(url, state, expiry, now).accepted, false);
  });
}
