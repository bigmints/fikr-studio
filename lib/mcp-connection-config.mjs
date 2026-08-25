function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function cleanStringRecord(value) {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .filter(([key, entry]) => key.trim() && typeof entry === "string")
    .map(([key, entry]) => [key.trim(), entry]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function parseMcpConnectionConfig(source) {
  let parsed;
  try {
    parsed = JSON.parse(String(source ?? ""));
  } catch {
    throw new Error("Paste a valid JSON configuration.");
  }

  if (!isRecord(parsed)) throw new Error("The MCP configuration must be a JSON object.");

  const collection = isRecord(parsed.mcpServers) ? parsed.mcpServers : null;
  const entries = collection ? Object.entries(collection) : [];
  if (collection && entries.length !== 1) {
    throw new Error("Paste one MCP server at a time so you can review its permissions.");
  }

  const name = collection ? String(entries[0][0] ?? "").trim() : String(parsed.name ?? "").trim();
  const descriptor = collection ? entries[0][1] : parsed;
  if (!name) throw new Error("This configuration needs a server name.");
  if (!isRecord(descriptor)) throw new Error("This MCP server configuration is invalid.");

  if (typeof descriptor.command === "string" && descriptor.command.trim()) {
    if (descriptor.args != null && (!Array.isArray(descriptor.args) || descriptor.args.some((arg) => typeof arg !== "string"))) {
      throw new Error("MCP command arguments must be a list of text values.");
    }
    return {
      name,
      transport: "stdio",
      command: descriptor.command.trim(),
      args: Array.isArray(descriptor.args) ? descriptor.args : [],
      env: cleanStringRecord(descriptor.env),
      cwd: typeof descriptor.cwd === "string" && descriptor.cwd.trim() ? descriptor.cwd.trim() : undefined,
      allowedTools: [],
      enabled: true,
    };
  }

  const url = [descriptor.url, descriptor.serverUrl, descriptor.httpUrl]
    .find((value) => typeof value === "string" && value.trim());
  if (!url) throw new Error("This configuration needs either a server URL or a local command.");

  const transportHint = String(descriptor.transport ?? descriptor.type ?? "").toLowerCase();
  return {
    name,
    transport: transportHint === "sse" ? "sse" : "streamable-http",
    url: String(url).trim(),
    headers: cleanStringRecord(descriptor.headers),
    allowedTools: [],
    enabled: true,
  };
}

export function describeMcpConnection(connection) {
  if (connection?.transport === "stdio") {
    return [connection.command, ...(Array.isArray(connection.args) ? connection.args : [])].join(" ");
  }
  return String(connection?.url ?? "");
}
