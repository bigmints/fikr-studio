const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const {
  assistantMessage,
  functionCall,
  ScriptedModel,
} = require('@openai/agents-core/testing');

const {
  classifyToolIntent,
  createCompatibleChatClient,
  discoverMcpTools,
  runFikrAgent,
  validateAgentRequest,
  validateMcpConnections,
} = require('../lib/agent-runtime');

test('validates local stdio MCP descriptors without accepting a shell command string', () => {
  const [connection] = validateMcpConnections([{
    name: 'files',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { ACCESS_TOKEN: 'private-token' },
    allowedTools: ['read_file'],
  }]);

  assert.equal(connection.transport, 'stdio');
  assert.equal(connection.command, 'node');
  assert.deepEqual(connection.args, ['server.js']);
  assert.throws(
    () => validateMcpConnections([{
      name: 'unsafe',
      transport: 'stdio',
      command: '',
      allowedTools: ['read_file'],
    }]),
    /Invalid MCP server command/,
  );
});

test('discovers tools from a real local stdio MCP server', async () => {
  const tools = await discoverMcpTools({
    name: 'local-test',
    transport: 'stdio',
    command: process.execPath,
    args: [require.resolve('./fixtures/stdio-mcp-server.mjs')],
  });

  assert.deepEqual(tools, [{
    name: 'local_fact',
    description: 'Returns one local test fact.',
  }]);
});

test('terminal tool permissions require explicit current-request intent', () => {
  assert.equal(classifyToolIntent('How many notes do I have?'), 'answer');
  assert.equal(classifyToolIntent('Summarize my marketing notes'), 'answer');
  assert.equal(classifyToolIntent('Find patterns across my marketing notes'), 'insight');
  assert.equal(classifyToolIntent('Save this as a note'), 'knowledge-building');
  assert.equal(classifyToolIntent('Create a LinkedIn post from my notes'), 'social-creation');
});

async function startTestMcpServer() {
  const httpServer = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const server = new McpServer({ name: 'fikr-agent-test', version: '1.0.0' });
    server.registerTool('echo_fact', {
      description: 'Returns one bounded test fact.',
      inputSchema: { text: z.string().max(100) },
    }, async ({ text }) => ({ content: [{ type: 'text', text: `Verified: ${text}` }] }));
    server.registerTool('hidden_tool', {
      description: 'Must remain outside the configured allowlist.',
      inputSchema: {},
    }, async () => ({ content: [{ type: 'text', text: 'hidden' }] }));

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } finally {
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    }
  });
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve())),
  };
}

function request(overrides = {}) {
  return {
    runId: 'run-test-1',
    query: 'What do my notes say about the launch?',
    history: [],
    sources: [
      {
        noteId: 'note-1',
        projectId: 'project-1',
        projectName: 'Launch',
        title: 'Customer interviews',
        text: 'Customers want a calmer onboarding flow before launch.',
        annotation: 'Prioritize onboarding clarity.',
        citationIndex: 1,
        score: 10,
      },
    ],
    provider: 'openrouter',
    model: 'test/model',
    ...overrides,
  };
}

test('uses a bounded compatible-provider transport without the full OpenAI client', async () => {
  let captured;
  const client = createCompatibleChatClient({
    apiKey: 'test-provider-key',
    baseURL: 'https://provider.example/v1/',
    defaultHeaders: { 'X-Title': 'Fikr' },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ id: 'completion-1', choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.chat.completions.create({ model: 'test-model', messages: [] });

  assert.equal(captured.url, 'https://provider.example/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-provider-key');
  assert.equal(captured.options.headers['X-Title'], 'Fikr');
  assert.deepEqual(JSON.parse(captured.options.body), { model: 'test-model', messages: [] });
  assert.equal(result.id, 'completion-1');
});

test('retries one transient compatible-provider failure', async () => {
  let calls = 0;
  const client = createCompatibleChatClient({
    apiKey: 'test-provider-key',
    baseURL: 'https://provider.example/v1',
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ error: { message: 'try again' } }), { status: 429, headers: { 'Retry-After': '0' } })
        : new Response(JSON.stringify({ id: 'completion-2', choices: [] }), { status: 200 });
    },
  });

  const result = await client.chat.completions.create({ model: 'test-model', messages: [] });

  assert.equal(calls, 2);
  assert.equal(result.id, 'completion-2');
});

const pngAttachment = {
  id: 'attachment-image',
  name: 'diagram.png',
  kind: 'image',
  mediaType: 'image/png',
  dataUrl: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64')}`,
};

const pdfAttachment = {
  id: 'attachment-pdf',
  name: 'brief.pdf',
  kind: 'pdf',
  mediaType: 'application/pdf',
  dataUrl: `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}`,
};

test('validates and bounds renderer agent requests', () => {
  const validated = validateAgentRequest(request({ attachments: [pngAttachment, pdfAttachment] }));
  assert.equal(validated.query, 'What do my notes say about the launch?');
  assert.equal(validated.sources.length, 1);
  assert.deepEqual(validated.attachments.map(({ name, kind, size }) => ({ name, kind, size })), [
    { name: 'diagram.png', kind: 'image', size: 9 },
    { name: 'brief.pdf', kind: 'pdf', size: 14 },
  ]);
  assert.throws(
    () => validateAgentRequest(request({ provider: 'unknown' })),
    /Unsupported agent provider/,
  );
  assert.throws(
    () => validateAgentRequest(request({ sources: new Array(21).fill(request().sources[0]) })),
    /Too many knowledge sources/,
  );
  assert.throws(
    () => validateAgentRequest(request({ attachments: new Array(5).fill(pngAttachment) })),
    /Attach up to 4 files/,
  );
  assert.throws(
    () => validateAgentRequest(request({ attachments: [{ ...pngAttachment, mediaType: 'image/jpeg' }] })),
    /Invalid attachment data/,
  );
  assert.throws(
    () => validateAgentRequest(request({ attachments: [{ ...pngAttachment, dataUrl: 'data:image/png;base64,aGVsbG8=' }] })),
    /does not match its file type/,
  );
});

test('passes validated images and PDFs to the Agents SDK model input', async () => {
  const model = new ScriptedModel([
    [assistantMessage('I can work with both attachments.')],
  ]);

  const result = await runFikrAgent({
    request: request({ sources: [], attachments: [pngAttachment, pdfAttachment] }),
    model,
  });

  model.assertComplete();
  const input = model.firstCall.request.input;
  assert.ok(Array.isArray(input));
  assert.equal(input[0].role, 'user');
  assert.equal(input[0].content[0].type, 'input_text');
  assert.deepEqual(input[0].content.slice(1).map((item) => item.type), ['input_image', 'input_file']);
  assert.equal(input[0].content[1].image, pngAttachment.dataUrl);
  assert.equal(input[0].content[2].filename, 'brief.pdf');
  assert.equal(result.answer, 'I can work with both attachments.');
});

test('a greeting remains an ordinary answer', async () => {
  const model = new ScriptedModel([
    [assistantMessage('Hello! What would you like to work on?')],
  ]);

  const result = await runFikrAgent({ request: request({ query: 'Hello', sources: [] }), model });

  model.assertComplete();
  assert.equal(result.outputKind, 'answer');
  assert.equal(result.artifact, undefined);
  assert.equal(result.insightDraft, undefined);
  assert.equal(result.noteDraft, undefined);
});

test('Agents SDK owns the tool loop while Fikr owns skills and knowledge tools', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch onboarding' }, { callId: 'call-search' })],
    [assistantMessage('The launch should prioritize a calmer onboarding flow [1].')],
  ]);
  const events = [];

  const result = await runFikrAgent({
    request: request(),
    model,
    onEvent: (event) => events.push(event),
  });

  model.assertComplete();
  assert.equal(result.answer, 'The launch should prioritize a calmer onboarding flow [1].');
  assert.equal(result.outputKind, 'answer');
  assert.equal(result.insightDraft, undefined);
  assert.deepEqual(result.sourceNoteIds, ['note-1']);
  assert.deepEqual(result.loadedSkills, ['knowledge-research']);
  assert.deepEqual(
    events.filter((event) => event.type === 'tool_completed').map((event) => event.toolName),
    ['activate_skill', 'search_fikr_knowledge'],
  );
});

test('citation numbers follow the source order returned to the renderer', async () => {
  const sources = [
    {
      ...request().sources[0],
      noteId: 'note-other',
      title: 'Unrelated note',
      text: 'A general product note.',
      citationIndex: 1,
      score: 0,
    },
    {
      ...request().sources[0],
      noteId: 'note-launch',
      title: 'Launch onboarding',
      text: 'Launch onboarding should stay calm.',
      citationIndex: 2,
      score: 0,
    },
  ];
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch onboarding' }, { callId: 'call-search' })],
    [assistantMessage('Keep launch onboarding calm [1].')],
  ]);

  const result = await runFikrAgent({ request: request({ sources }), model });

  model.assertComplete();
  assert.equal(result.answer, 'Keep launch onboarding calm [1].');
  assert.deepEqual(result.sourceNoteIds, ['note-launch', 'note-other']);
});

test('social creation is a Fikr tool result, not untrusted final-output JSON', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'social-creation' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch onboarding' }, { callId: 'call-search' })],
    [functionCall('create_social_post', {
      platform: 'linkedin',
      title: 'A calmer launch',
      content: 'The best launches begin with calm onboarding.',
      sourceNoteIds: ['note-1'],
    }, { callId: 'call-create' })],
  ]);

  const result = await runFikrAgent({ request: request({ query: 'Create a LinkedIn post from my launch notes' }), model });

  model.assertComplete();
  assert.deepEqual(result.artifact, {
    kind: 'social-post',
    platform: 'linkedin',
    title: 'A calmer launch',
    content: 'The best launches begin with calm onboarding.',
    sourceNoteIds: ['note-1'],
  });
  assert.equal(result.outputKind, 'creation');
  assert.equal(result.answer, 'I created the draft. It’s ready below.');
  assert.equal(result.answer.includes(result.artifact.content), false);
  assert.equal(result.insightDraft, undefined);
});

test('an ordinary answer cannot invoke a terminal creation tool', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'note count' }, { callId: 'call-search' })],
    [functionCall('create_social_post', {
      platform: 'linkedin',
      title: 'Wrong tool',
      content: 'This must not become a creation.',
      sourceNoteIds: ['note-1'],
    }, { callId: 'call-forbidden-create' })],
    [assistantMessage('The available knowledge does not establish the total note count.')],
  ]);

  const result = await runFikrAgent({
    request: request({ query: 'How many notes do I have?' }),
    model,
  });

  model.assertComplete();
  assert.equal(result.outputKind, 'answer');
  assert.equal(result.artifact, undefined);
  assert.equal(result.answer, 'The available knowledge does not establish the total note count.');
});

test('only draft_insight creates an insight output', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch onboarding patterns' }, { callId: 'call-search' })],
    [functionCall('draft_insight', {
      title: 'Calm is part of the product value',
      content: 'The notes connect onboarding clarity with launch confidence.',
      sourceNoteIds: ['note-1'],
    }, { callId: 'call-insight' })],
  ]);

  const result = await runFikrAgent({ request: request({ query: 'Find a pattern in my launch notes' }), model });

  model.assertComplete();
  assert.equal(result.outputKind, 'insight');
  assert.equal(result.answer, 'I found a new insight. Review it below, then save it if it’s useful.');
  assert.equal(result.answer.includes('The notes connect onboarding clarity'), false);
  assert.deepEqual(result.insightDraft, {
    title: 'Calm is part of the product value',
    content: 'The notes connect onboarding clarity with launch confidence.',
    sourceNoteIds: ['note-1'],
  });
  assert.equal(result.artifact, undefined);
});

test('draft_knowledge_note creates one concise review step without persisting it', async () => {
  const draftContent = '**Principle**\n\nKeep onboarding calm and clear.';
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-building' }, { callId: 'call-skill' })],
    [functionCall('draft_knowledge_note', {
      title: 'Launch principle',
      content: draftContent,
    }, { callId: 'call-note' })],
  ]);

  const result = await runFikrAgent({ request: request({ query: 'Draft a note from this idea' }), model });

  model.assertComplete();
  assert.equal(result.outputKind, 'knowledge-note');
  assert.equal(result.answer, 'I drafted the note. Review it below, then save when ready.');
  assert.equal(result.answer.includes(draftContent), false);
  assert.deepEqual(result.noteDraft, {
    title: 'Launch principle',
    content: draftContent,
  });
  assert.equal('saved' in result, false);
});

test('knowledge-note acknowledgement mentions a current attachment without repeating its draft', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-building' }, { callId: 'call-skill' })],
    [functionCall('draft_knowledge_note', {
      title: 'Diagram notes',
      content: 'A concise summary of the diagram.',
    }, { callId: 'call-note' })],
  ]);

  const result = await runFikrAgent({
    request: request({ query: 'Save this as a note', sources: [], attachments: [pngAttachment] }),
    model,
  });

  model.assertComplete();
  assert.equal(result.answer, 'I drafted the note from your attachment. Review it below, then save when ready.');
  assert.equal(result.answer.includes(result.noteDraft.content), false);
});

test('inspect_fikr_note is available only after search returned that note', async () => {
  const model = new ScriptedModel([
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch onboarding' }, { callId: 'call-search' })],
    [functionCall('inspect_fikr_note', { noteId: 'note-1' }, { callId: 'call-inspect' })],
    [assistantMessage('The detailed note says customers want calmer onboarding [1].')],
  ]);

  const result = await runFikrAgent({ request: request(), model });

  model.assertComplete();
  assert.equal(result.answer, 'The detailed note says customers want calmer onboarding [1].');
  assert.deepEqual(result.sourceNoteIds, ['note-1']);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'tool_completed').map((event) => event.toolName),
    ['activate_skill', 'search_fikr_knowledge', 'inspect_fikr_note'],
  );
});

test('forbidden tool ordering fails closed and lets the model recover safely', async () => {
  const model = new ScriptedModel([
    [functionCall('search_fikr_knowledge', { query: 'launch' }, { callId: 'call-search-too-early' })],
    [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
    [functionCall('search_fikr_knowledge', { query: 'launch' }, { callId: 'call-search-valid' })],
    [assistantMessage('The note prioritizes calmer onboarding [1].')],
  ]);

  const result = await runFikrAgent({ request: request(), model });

  model.assertComplete();
  assert.equal(result.answer, 'The note prioritizes calmer onboarding [1].');
  assert.deepEqual(result.sourceNoteIds, ['note-1']);
  assert.deepEqual(result.loadedSkills, ['knowledge-research']);
});

test('an aborted agent run rejects without fabricating a result', async () => {
  const controller = new AbortController();
  controller.abort();
  const model = new ScriptedModel([[assistantMessage('This must never be returned.')]]);
  const events = [];

  await assert.rejects(
    () => runFikrAgent({ request: request(), model, signal: controller.signal, onEvent: (event) => events.push(event) }),
    (error) => error?.name === 'AbortError',
  );
  assert.equal(events.at(-1)?.type, 'run_canceled');
  assert.equal(events.some((event) => event.type === 'run_failed'), false);
});

test('attachment validation enforces exact aggregate bytes and file signatures', () => {
  const tooLargePayload = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(10 * 1024 * 1024),
  ]).toString('base64');
  assert.throws(
    () => validateAgentRequest(request({ attachments: [{ ...pngAttachment, dataUrl: `data:image/png;base64,${tooLargePayload}` }] })),
    /larger than 10 MB/,
  );

  const fakeWebp = Buffer.from('RIFFxxxxNOTW').toString('base64');
  assert.throws(
    () => validateAgentRequest(request({ attachments: [{
      ...pngAttachment,
      name: 'fake.webp',
      kind: 'image',
      mediaType: 'image/webp',
      dataUrl: `data:image/webp;base64,${fakeWebp}`,
    }] })),
    /does not match its file type/,
  );
});

test('connects to a real MCP server and exposes only explicitly allowlisted tools', async () => {
  const mcp = await startTestMcpServer();
  try {
    const discovered = await discoverMcpTools({
      name: 'test-mcp',
      url: mcp.url,
      transport: 'streamable-http',
    });
    assert.deepEqual(discovered.map((tool) => tool.name).sort(), ['echo_fact', 'hidden_tool']);

    const model = new ScriptedModel([
      [functionCall('activate_skill', { name: 'knowledge-research' }, { callId: 'call-skill' })],
      [functionCall('echo_fact', { text: 'MCP works' }, { callId: 'call-mcp' })],
      [assistantMessage('The connected MCP returned a verified result.')],
    ]);
    const result = await runFikrAgent({
      request: request({
        query: 'Use the connected test tool',
        sources: [],
        mcpServers: [{
          name: 'test-mcp',
          url: mcp.url,
          transport: 'streamable-http',
          allowedTools: ['echo_fact'],
        }],
      }),
      model,
    });

    model.assertComplete();
    assert.equal(result.answer, 'The connected MCP returned a verified result.');
    assert.equal(result.events.some((event) => event.type === 'mcp_connected'), true);
    const firstTools = model.firstCall.request.tools.map((tool) => tool.name);
    assert.equal(firstTools.includes('echo_fact'), true);
    assert.equal(firstTools.includes('hidden_tool'), false);
  } finally {
    await mcp.close();
  }
});
