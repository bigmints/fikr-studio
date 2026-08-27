const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('plain-language app connections is the primary Connections banner', () => {
  const connections = source('components/connections-page.tsx');
  const messengerIndex = connections.indexOf('data-testid="messenger-hooks-banner"');
  const localIndex = connections.indexOf('data-testid="local-connections-banner"');
  const appsIndex = connections.indexOf('aria-labelledby="ai-apps-heading"');

  assert.ok(messengerIndex >= 0);
  assert.ok(messengerIndex < localIndex);
  assert.ok(localIndex < appsIndex);
  assert.match(connections, /Remote connections/);
  assert.match(connections, /Connect apps that work while Fikr is closed/);
  assert.match(connections, /Plus and Pro let apps and services send notes to Fikr over the internet/);
  assert.match(connections, /Fikr Studio does not need to be open/);
  assert.match(connections, /Connect an app to Fikr/);
  assert.match(connections, /Send a note from that app/);
  assert.match(connections, /Find it in Fikr when you return/);
  assert.match(connections, /Get Plus to connect apps/);
  assert.doesNotMatch(connections, /Messenger Hooks|server-side workflow|exposing local tools|secure inbox|save from anywhere/i);
});

test('free connections state the open-app boundary without jargon or repetition', () => {
  const connections = source('components/connections-page.tsx');

  assert.match(connections, /<Zap[^>]*\/> Free/);
  assert.match(connections, /Connect your AI tools/);
  assert.match(connections, /Works on this computer while Fikr Studio is open/);
  assert.match(connections, />Setup<\/p>/);
  assert.match(connections, /On this computer/);
  assert.match(connections, /Keep Fikr Studio open/);
  assert.doesNotMatch(connections, /Local connections/);
  assert.doesNotMatch(connections, /Free local setup/);
});

test('local setup prompt is a semantic code block', () => {
  const connections = source('components/connections-page.tsx');

  assert.match(connections, /<pre[^>]*>[\s\S]*<code>\{visibleConnectionPrompt\}<\/code>[\s\S]*<\/pre>/);
  assert.doesNotMatch(connections, /<p[^>]*>\s*\{visibleConnectionPrompt\}\s*<\/p>/);
});

test('local install and copy actions fail closed until desktop credentials are ready', () => {
  const connections = source('components/connections-page.tsx');

  assert.match(connections, /const localConnectionReady = Boolean\(ipc\?\.installMcp && mcpToken\)/);
  assert.match(connections, /disabled=\{!localConnectionReady \|\| installing === integration\.id\}/);
  assert.match(connections, /disabled=\{!localConnectionReady\}/);
  assert.match(connections, /const installed = await ipc\.installMcp\(id\)/);
  assert.match(connections, /const result = await ipc\.testMcp\(id\)/);
  assert.match(connections, /toast\.error\("Couldn’t install this connection"/);
});

test('one-click client configs use compatible transports and paths', () => {
  const main = source('main.js');
  const connections = source('components/connections-page.tsx');

  assert.match(main, /client === "claude"[\s\S]*command: findCompatibleNpx\(\)[\s\S]*"fikr-studio-mcp@latest"/);
  assert.match(main, /client === "windsurf"[\s\S]*\.codeium", "windsurf", "mcp_config\.json"/);
  assert.match(main, /client === "windsurf"[\s\S]*serverUrl:/);
  assert.match(connections, /command: "npx", args: \["-y", "fikr-studio-mcp@latest", endpoint\]/);
  assert.doesNotMatch(connections, /windsurf\/mcp_settings\.json/);
});
