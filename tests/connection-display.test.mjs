import test from "node:test";
import assert from "node:assert/strict";
import { actionableIpcError, maskLocalMcpText } from "../lib/connection-display.mjs";

test("masks local MCP tokens in visible endpoint text without changing copy text", () => {
  const token = "local-secret-token";
  const full = `http://localhost:3025/sse?token=${encodeURIComponent(token)}`;
  const visible = maskLocalMcpText(full, token);

  assert.equal(full.includes(token), true);
  assert.equal(visible.includes(token), false);
  assert.match(visible, /token=••••••••/);
});

test("shows actionable MCP errors without Electron IPC implementation details", () => {
  const message = actionableIpcError(
    new Error("Error invoking remote method 'fikr-studio:discover-agent-mcp-tools': Error: MCP servers must use HTTPS or a loopback HTTP URL"),
    "Couldn’t connect.",
  );

  assert.equal(message, "MCP servers must use HTTPS or a loopback HTTP URL");
  assert.equal(message.includes("remote method"), false);
});

test("replaces low-level MCP transport failures with product copy", () => {
  const message = actionableIpcError(
    new Error("SdkError: Version negotiation probe failed: fetch failed"),
    "Couldn’t connect to this MCP server.",
  );

  assert.equal(message, "Couldn’t connect to this MCP server. Check the URL and make sure the server is running.");
  assert.equal(message.includes("SdkError"), false);
});
