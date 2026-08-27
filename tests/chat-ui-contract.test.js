const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('insight and knowledge-note drafts both use the Markdown renderer', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const insightSection = component.match(/data-testid="insight-output"[\s\S]*?data-testid="knowledge-note-output"/)?.[0] ?? '';

  assert.match(insightSection, /<SharedMarkdown[^>]*>\{message\.insightDraft\.content\}<\/SharedMarkdown>/);
  assert.doesNotMatch(insightSection, /<p[^>]*>\{message\.insightDraft\.content\}<\/p>/);

  assert.match(component, /<SharedMarkdown[^>]*>\{message\.noteDraft\.content\}<\/SharedMarkdown>/);
  assert.match(component, /import \{ SharedMarkdown \} from "@\/components\/shared-markdown"/);
});

test('knowledge scope remains editable after a chat has responses', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /onValueChange=\{handleScopeChange\}/);
  assert.match(component, /updateThread\(activeThread\.id, \(thread\) => \(\{ \.\.\.thread, scope: nextScope \}\)\)/);
  assert.doesNotMatch(component, /disabled=\{Boolean\(activeThread\?\.messages\.length\)\}/);
  assert.doesNotMatch(component, /Knowledge scope is fixed for this chat/);
});

test('grouped provider citations become individual clickable source links', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /contents\.matchAll\(\/\\d\+\/g\)/);
  assert.match(component, /`\[\$\{index\}\]\(#fikr-source-\$\{index\}\)`/);
});

test('web citations remain distinct, clickable, and visible in source details', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /#fikr-web-source-/);
  assert.match(component, /data-testid="chat-web-sources"/);
  assert.match(component, /message\.webSources/);
  assert.match(component, /From a webpage/);
  assert.match(component, /ipc\.openUrl\(source\.finalUrl\)/);
});

test('PDF citations preserve document and page provenance in chat details', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /#fikr-document-source-D/);
  assert.match(component, /data-testid="chat-document-sources"/);
  assert.match(component, /message\.documentSources/);
  assert.match(component, /source\.extractionMethod === "ocr"/);
});

test('chat composers use a shadcn plus menu for images and PDFs', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /<DropdownMenu>/);
  assert.match(component, /aria-label="Add photos or files"/);
  assert.match(component, /<span className="font-medium">Upload image<\/span>/);
  assert.match(component, /<span className="font-medium">Upload PDF<\/span>/);
  assert.match(component, /\{renderAttachmentMenu\("bottom"\)\}/);
  assert.match(component, /\{renderAttachmentMenu\("top"\)\}/);
  assert.match(component, /accept=\{IMAGE_ATTACHMENT_ACCEPT\}/);
  assert.match(component, /accept=\{PDF_ATTACHMENT_ACCEPT\}/);
  assert.match(component, /const PDF_ATTACHMENT_ACCEPT = "\.pdf";/);
  assert.match(component, /alt=\{attachment\.name\}/);
  assert.doesNotMatch(component, /<Paperclip/);
  assert.doesNotMatch(component, />Add files<\/span>/);
});

test('creation artifacts show their complete Markdown content inline', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const artifactMarkdown = component.match(/<SharedMarkdown className="fikr-artifact-markdown[^"]*"/)?.[0] ?? '';

  assert.match(artifactMarkdown, /fikr-artifact-markdown text-sm/);
  assert.doesNotMatch(artifactMarkdown, /max-h-|overflow-hidden|line-clamp/);
});

test('new creations save once while user-deleted creations stay deleted', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');

  assert.match(component, /if \(generation\.artifact && !isCreationSaved\(threadId, generation\.artifact\)\)/);
  assert.match(component, />Save to Creations<\/Button>/);
  assert.match(component, /"Not in Creations"/);
  assert.doesNotMatch(component, /const unsavedArtifacts = threads\.flatMap/);
});

test('external MCP tool calls have an action-time approval surface', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');

  assert.match(component, /pendingToolApproval/);
  assert.match(component, /Allow this tool once\?/);
  assert.match(component, /respondAgentApproval/);
  assert.match(component, />Reject<\/Button>/);
  assert.match(component, />Allow once<\/Button>/);
  assert.match(preload, /respondAgentApproval/);
});

test('chat errors never expose raw Electron agent IPC exceptions', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'lib', 'fikr-chat.ts'), 'utf8');

  assert.match(component, /setError\(friendlyChatError\(caught\)\)/);
  assert.match(chat, /Error invoking remote method .*fikr-studio:run-agent/);
  assert.match(chat, /I couldn’t verify that answer against your knowledge/);
});

test('durable memories flow through chat and workspace persistence', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'fikr-chat.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'lib', 'fikr-chat.ts'), 'utf8');

  assert.match(component, /memories,/);
  assert.match(component, /applyChatMemoryMutations/);
  assert.match(chat, /memories: normalizeChatMemories\(memories\)/);
  assert.match(chat, /executeChatMemoryCommand\(trimmedQuery, memories\)/);
  assert.match(page, /const \[chatMemories, setChatMemories\]/);
  assert.match(page, /chatMemories,/);
  assert.match(page, /memories=\{chatMemories\}/);
  assert.match(page, /setMemories=\{setChatMemories\}/);
});
