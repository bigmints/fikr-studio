const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'agent-mcp-connections.tsx'), 'utf8');

test('MCP setup uses shadcn controls and a config-first permission flow', () => {
  assert.match(source, /parseMcpConnectionConfig/);
  assert.match(source, /<Dialog open=/);
  assert.match(source, /<Tabs value=/);
  assert.match(source, /<Checkbox checked=/);
  assert.match(source, /Connect and review/);
  assert.doesNotMatch(source, /<select\b/);
  assert.doesNotMatch(source, /type="checkbox"/);
});
