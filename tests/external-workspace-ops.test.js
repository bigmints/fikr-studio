const assert = require('node:assert/strict');
const test = require('node:test');
const { createExternalWorkspaceOpBuffer } = require('../lib/external-workspace-ops');

function workspace(blocks = []) {
  return {
    projects: [{ id: 'project-1', name: 'QA', blocks }],
    studioProjects: [{ id: 'creation-1' }],
    chatThreads: [{ id: 'chat-1' }],
  };
}

test('protects rapid external adds and updates from a stale renderer save', () => {
  const buffer = createExternalWorkspaceOpBuffer();
  buffer.recordNoteAdded('project-1', { id: 'raw', text: 'raw', contentType: 'general', isEnriching: true });
  buffer.recordNoteAdded('project-1', { id: 'synth', text: 'synth', contentType: 'reference', annotation: 'ready', isEnriching: false });
  buffer.recordNoteUpdated('project-1', { id: 'raw', text: 'updated', contentType: 'reference', annotation: 'done', isEnriching: false });

  const protectedWorkspace = buffer.protect(workspace());
  assert.deepEqual(protectedWorkspace.projects[0].blocks.map((note) => note.id).sort(), ['raw', 'synth']);
  assert.equal(protectedWorkspace.projects[0].blocks.find((note) => note.id === 'raw').text, 'updated');
  assert.deepEqual(protectedWorkspace.studioProjects, [{ id: 'creation-1' }]);
  assert.deepEqual(protectedWorkspace.chatThreads, [{ id: 'chat-1' }]);
  assert.equal(buffer.pendingCount, 2);

  buffer.protect(protectedWorkspace);
  assert.equal(buffer.pendingCount, 0);
});

test('protects an external delete until the renderer reflects it', () => {
  const buffer = createExternalWorkspaceOpBuffer();
  buffer.recordNoteDeleted('project-1', 'deleted');

  const protectedWorkspace = buffer.protect(workspace([{ id: 'kept' }, { id: 'deleted' }]));
  assert.deepEqual(protectedWorkspace.projects[0].blocks.map((note) => note.id), ['kept']);
  assert.equal(buffer.pendingCount, 1);

  buffer.protect(protectedWorkspace);
  assert.equal(buffer.pendingCount, 0);
});

test('protects an externally created project from a stale renderer save', () => {
  const buffer = createExternalWorkspaceOpBuffer();
  buffer.recordProjectCreated({ id: 'project-2', name: 'Created by MCP', blocks: [] });
  const protectedWorkspace = buffer.protect(workspace());
  assert.deepEqual(protectedWorkspace.projects.map((project) => project.id), ['project-1', 'project-2']);
});
