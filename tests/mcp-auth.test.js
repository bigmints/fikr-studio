const test = require('node:test');
const assert = require('node:assert/strict');
const { isAuthorizedMcpRequest } = require('../lib/mcp-auth');

const expected = 'a'.repeat(64);
const url = value => new URL(`http://localhost:3025/sse${value ? `?token=${value}` : ''}`);

test('rejects unauthenticated and malformed MCP requests', () => {
  assert.equal(isAuthorizedMcpRequest({ headers: {} }, url(), expected), false);
  assert.equal(isAuthorizedMcpRequest({ headers: { authorization: 'Basic nope' } }, url(), expected), false);
  assert.equal(isAuthorizedMcpRequest({ headers: { authorization: 'Bearer short' } }, url(), expected), false);
});

test('accepts exact bearer and query tokens', () => {
  assert.equal(isAuthorizedMcpRequest({ headers: { authorization: `Bearer ${expected}` } }, url(), expected), true);
  assert.equal(isAuthorizedMcpRequest({ headers: {} }, url(expected), expected), true);
});

test('bearer header takes precedence over a query token', () => {
  const request = { headers: { authorization: `Bearer ${'b'.repeat(64)}` } };
  assert.equal(isAuthorizedMcpRequest(request, url(expected), expected), false);
});
