const fs = require('node:fs');
const path = require('node:path');
const { validateMcpConnections } = require('./agent-runtime');

const MAX_CONNECTIONS = 5;

function createAgentMcpConfigStore(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('MCP connection store requires an absolute path');
  }

  function normalize(candidate) {
    const [validated] = validateMcpConnections([candidate]);
    return { ...validated, enabled: candidate.enabled !== false };
  }

  function list() {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const connections = [];
    for (const candidate of raw.slice(0, MAX_CONNECTIONS)) {
      try {
        connections.push(normalize(candidate));
      } catch {
        // Invalid records never reach the agent runtime.
      }
    }
    return connections;
  }

  function write(connections) {
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(connections, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  }

  function upsert(candidate) {
    const connection = normalize(candidate);
    const current = list().filter((item) => item.name !== connection.name);
    if (current.length >= MAX_CONNECTIONS) throw new Error('Too many MCP servers');
    const next = [...current, connection].sort((left, right) => left.name.localeCompare(right.name));
    write(next);
    return connection;
  }

  function remove(nameValue) {
    const name = String(nameValue ?? '').trim();
    const current = list();
    const next = current.filter((connection) => connection.name !== name);
    if (next.length === current.length) return false;
    write(next);
    return true;
  }

  function setEnabled(nameValue, enabledValue) {
    const name = String(nameValue ?? '').trim();
    const current = list();
    const index = current.findIndex((connection) => connection.name === name);
    if (index < 0) throw new Error('MCP server not found');
    const next = current.slice();
    next[index] = { ...next[index], enabled: enabledValue === true };
    write(next);
    return next[index];
  }

  function listSafe() {
    return list().map(({ env, headers, ...connection }) => ({
      ...connection,
      hasPrivateConfig: Boolean(
        (env && Object.keys(env).length > 0)
        || (headers && Object.keys(headers).length > 0),
      ),
    }));
  }

  return { list, listSafe, remove, setEnabled, upsert };
}

module.exports = { createAgentMcpConfigStore };
