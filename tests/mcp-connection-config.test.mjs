import test from 'node:test';
import assert from 'node:assert/strict';

import { describeMcpConnection, parseMcpConnectionConfig } from '../lib/mcp-connection-config.mjs';

test('imports one hosted MCP server from a standard mcpServers block', () => {
  const connection = parseMcpConnectionConfig(JSON.stringify({
    mcpServers: {
      research: {
        url: 'https://mcp.example.com/mcp',
        headers: { Authorization: 'Bearer private-token' },
      },
    },
  }));

  assert.equal(connection.name, 'research');
  assert.equal(connection.transport, 'streamable-http');
  assert.equal(connection.url, 'https://mcp.example.com/mcp');
  assert.deepEqual(connection.headers, { Authorization: 'Bearer private-token' });
});
test('imports a local stdio MCP command without turning it into a shell command', () => {
  const connection = parseMcpConnectionConfig(JSON.stringify({
    mcpServers: {
      files: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/notes'],
        env: { ACCESS_TOKEN: 'private-token' },
      },
    },
  }));

  assert.equal(connection.name, 'files');
  assert.equal(connection.transport, 'stdio');
  assert.equal(connection.command, 'npx');
  assert.deepEqual(connection.args, ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/notes']);
  assert.equal(describeMcpConnection(connection), 'npx -y @modelcontextprotocol/server-filesystem /tmp/notes');
});

test('requires one server per permission review', () => {
  assert.throws(
    () => parseMcpConnectionConfig(JSON.stringify({
      mcpServers: {
        first: { url: 'https://first.example/mcp' },
        second: { url: 'https://second.example/mcp' },
      },
    })),
    /one MCP server at a time/,
  );
});
