const MAX_RPC_BYTES = 1024 * 1024;
const MAX_TEXT_LENGTH = 256 * 1024;
const MAX_ID_LENGTH = 256;

const METHODS = new Set([
  'initialize', 'prompts/list', 'prompts/get', 'tools/list', 'tools/call',
  'resources/list', 'resources/read', 'resources/subscribe', 'resources/unsubscribe',
  'notifications/initialized', 'notifications/cancelled', 'notifications/progress',
]);

const CONTENT_TYPES = new Set([
  'claim', 'question', 'task', 'idea', 'entity', 'quote', 'reference',
  'definition', 'opinion', 'reflection', 'narrative', 'comparison', 'general',
]);

const TOOL_FIELDS = {
  list_projects: [],
  get_canvas: ['project_id'],
  search_notes: ['query', 'project_id', 'limit'],
  create_note: ['text', 'project_id', 'idempotency_key'],
  create_project: ['name'],
  delete_note: ['note_id', 'project_id'],
  update_note: ['note_id', 'new_text', 'project_id', 'type', 'category', 'annotation'],
  get_synthesis: ['project_id'],
  create_note_synthesized: ['text', 'project_id', 'contentType', 'category', 'annotation', 'confidence'],
};

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertString(value, label, { required = false, max = MAX_TEXT_LENGTH } = {}) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new Error(`Invalid ${label}`);
  }
}

function rejectUnexpectedFields(value, allowed, label) {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  if (unexpected.length) throw new Error(`Unexpected ${label} field: ${unexpected[0]}`);
}

function validateToolCall(name, args) {
  if (typeof name !== 'string' || !Object.hasOwn(TOOL_FIELDS, name)) throw new Error('Unknown MCP tool');
  assertRecord(args, 'Tool arguments');
  rejectUnexpectedFields(args, TOOL_FIELDS[name], 'tool argument');
  for (const field of ['project_id', 'note_id', 'idempotency_key']) assertString(args[field], field, { max: MAX_ID_LENGTH });

  switch (name) {
    case 'list_projects':
    case 'get_canvas':
    case 'get_synthesis':
      break;
    case 'search_notes':
      assertString(args.query, 'query', { required: true, max: 10_000 });
      if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50)) throw new Error('Invalid limit');
      break;
    case 'create_note':
      assertString(args.text, 'text', { required: true });
      break;
    case 'create_project':
      assertString(args.name, 'name', { required: true, max: 200 });
      break;
    case 'delete_note':
      assertString(args.note_id, 'note_id', { required: true, max: MAX_ID_LENGTH });
      break;
    case 'update_note':
      assertString(args.note_id, 'note_id', { required: true, max: MAX_ID_LENGTH });
      assertString(args.new_text, 'new_text', { required: true });
      assertString(args.type, 'type', { max: 100 });
      assertString(args.category, 'category', { max: 200 });
      assertString(args.annotation, 'annotation');
      break;
    case 'create_note_synthesized':
      assertString(args.text, 'text', { required: true });
      assertString(args.contentType, 'contentType', { required: true, max: 100 });
      if (!CONTENT_TYPES.has(args.contentType)) throw new Error('Invalid contentType');
      assertString(args.category, 'category', { required: true, max: 200 });
      assertString(args.annotation, 'annotation', { required: true });
      if (args.confidence != null && (typeof args.confidence !== 'number' || !Number.isFinite(args.confidence) || args.confidence < 0 || args.confidence > 100)) {
        throw new Error('Invalid confidence');
      }
      break;
  }
  return args;
}

function validateMcpRpc(rpc) {
  assertRecord(rpc, 'MCP request');
  const serialized = JSON.stringify(rpc);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_RPC_BYTES) throw new Error('MCP request exceeds 1 MB');
  if (typeof rpc.method !== 'string' || !METHODS.has(rpc.method)) throw new Error('Unsupported MCP method');
  if (rpc.id != null && !['string', 'number'].includes(typeof rpc.id)) throw new Error('Invalid MCP id');
  if (typeof rpc.id === 'string' && rpc.id.length > MAX_ID_LENGTH) throw new Error('Invalid MCP id');
  if (rpc.params != null) assertRecord(rpc.params, 'MCP params');

  if (rpc.method === 'tools/call') {
    assertRecord(rpc.params, 'MCP params');
    rejectUnexpectedFields(rpc.params, ['name', 'arguments'], 'tool call');
    validateToolCall(rpc.params.name, rpc.params.arguments ?? {});
  }
  if (rpc.method === 'resources/read' && rpc.params?.uri !== 'fikr-studio://projects') throw new Error('Unsupported resource URI');
  if (rpc.method === 'prompts/get') {
    if (rpc.params?.name !== 'pre_synthesis') throw new Error('Unsupported prompt');
    assertString(rpc.params?.arguments?.text, 'prompt text');
  }
  return rpc;
}

module.exports = { MAX_RPC_BYTES, validateMcpRpc, validateToolCall };
