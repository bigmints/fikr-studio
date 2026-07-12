const MAX_NOTE_TEXT = 240 * 1024;

function boundedText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length <= MAX_NOTE_TEXT) return text;
  return `${text.slice(0, MAX_NOTE_TEXT)}\n\n[External message truncated]`;
}

function extractMessageText(payload) {
  const direct = boundedText(payload);
  if (direct) return direct;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const field of ['text', 'message', 'content', 'body', 'description']) {
      const candidate = boundedText(payload[field]);
      if (candidate) return candidate;
    }
  }
  const serialized = JSON.stringify(payload, null, 2);
  return boundedText(serialized) || 'External webhook received';
}

function externalRelayMessageToRpc(message) {
  if (!message || typeof message !== 'object') throw new Error('Invalid external relay message');
  if (typeof message.id !== 'string' || typeof message.leaseToken !== 'string') {
    throw new Error('Invalid external relay lease');
  }
  const args = { text: extractMessageText(message.payload), idempotency_key: message.id };
  if (typeof message.defaultProjectId === 'string' && message.defaultProjectId) {
    args.project_id = message.defaultProjectId;
  }
  return {
    jsonrpc: '2.0',
    id: message.id,
    method: 'tools/call',
    params: { name: 'create_note', arguments: args },
  };
}

module.exports = { MAX_NOTE_TEXT, extractMessageText, externalRelayMessageToRpc };
