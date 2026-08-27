const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'agent-mcp-connections.tsx'), 'utf8');

test('MCP setup uses shadcn controls and a config-first permission flow', () => {
  assert.match(source, /parseMcpConnectionConfig/);
  assert.match(source, /<Dialog open=/);
  assert.match(source, /<DialogTrigger asChild>/);
  assert.match(source, /<DialogContent className=/);
  assert.match(source, /<DialogHeader>/);
  assert.match(source, /<DialogFooter>/);
  assert.match(source, /<DialogClose asChild>/);
  assert.match(source, /<Tabs className="gap-0" value=/);
  assert.match(source, /<TabsList aria-label="Connection type" className="grid h-10 w-full grid-cols-2/);
  assert.equal((source.match(/min-h-\[296px\]/g) ?? []).length, 2);
  assert.match(source, /<Checkbox checked=/);
  assert.match(source, /Connect and review/);
  assert.doesNotMatch(source, /<DialogContent[^>]*\b(?:gap-0|p-0)\b/);
  assert.doesNotMatch(source, /<select\b/);
  assert.doesNotMatch(source, /type="checkbox"/);
});
