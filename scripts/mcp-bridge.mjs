#!/usr/bin/env node
import readline from "readline";
import path from "path";
import os from "os";
import fs from "fs";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

function getTargetUrl() {
  if (process.argv[2]) {
    return process.argv[2];
  }

  const home = os.homedir();
  let userDataDir;
  if (process.platform === "darwin") {
    userDataDir = path.join(home, "Library", "Application Support", "fikr-studio");
  } else if (process.platform === "win32") {
    userDataDir = path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "fikr-studio");
  } else {
    userDataDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "fikr-studio");
  }

  const lockfilePath = path.join(userDataDir, "mcp-port.json");
  try {
    if (fs.existsSync(lockfilePath)) {
      const data = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
      if (data && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.error("Warning: failed to read lockfile at", lockfilePath, err.message);
  }

  return "http://127.0.0.1:3025/sse";
}

async function main() {
  const url = getTargetUrl();

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
    console.error("Failed to connect to SSE server at " + url + ":", err);
    process.exit(1);
  }

  // THEN proxy messages from standard input to the SSE transport using readline
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
  });

  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      transport.send(message).catch((err) => {
        console.error("Failed to send message:", err);
      });
    } catch (err) {
      console.error("Failed to parse stdin line:", err);
    }
  });
}

main().catch(console.error);
