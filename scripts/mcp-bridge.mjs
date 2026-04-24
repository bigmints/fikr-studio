#!/usr/bin/env node
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node mcp-bridge.js <sse-url>");
    process.exit(1);
  }

  const relayKey = process.env.MCP_RELAY_KEY || process.env.MCP_REMOTE_AUTH;
  const headers = {};
  if (relayKey) {
    headers.Authorization = `Bearer ${relayKey.replace('Bearer ', '')}`;
  }

  // Set up the SSE Transport
  const transport = new SSEClientTransport(new URL(url), {
    eventSourceInit: { headers },
    requestInit: { headers }
  });

  // Proxy messages from the SSE transport to standard output
  transport.onmessage = (message) => {
    console.log(JSON.stringify(message));
  };

  transport.onerror = (error) => {
    console.error("Transport error:", error);
  };

  transport.onclose = () => {
    process.exit(0);
  };

  // Connect the transport FIRST
  try {
    await transport.start();
  } catch (err) {
    console.error("Failed to connect to SSE server:", err);
    process.exit(1);
  }

  // THEN proxy messages from standard input to the SSE transport
  process.stdin.on("data", (chunk) => {
    try {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        transport.send(message).catch((err) => {
          console.error("Failed to send message:", err);
        });
      }
    } catch (err) {
      console.error("Failed to parse stdin chunk:", err);
    }
  });
}

main().catch(console.error);
