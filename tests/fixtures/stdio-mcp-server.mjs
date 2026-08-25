import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'fikr-stdio-test', version: '1.0.0' });

server.registerTool('local_fact', {
  description: 'Returns one local test fact.',
  inputSchema: { text: z.string().max(100) },
}, async ({ text }) => ({ content: [{ type: 'text', text: `Local: ${text}` }] }));

await server.connect(new StdioServerTransport());
