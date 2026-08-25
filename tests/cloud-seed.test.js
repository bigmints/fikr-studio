const test = require('node:test');
const assert = require('node:assert/strict');
const { selectFirstSyncWorkspace } = require('../lib/cloud-seed');

test('seeds existing local data exactly when the cloud has never been initialized', () => {
  const local = { projects: [{ id: 'local' }], studioProjects: [{ id: 'draft' }] };
  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: { projects: [] }, initialized: false, localWorkspace: local }), {
    workspace: local,
    shouldSeed: true,
  });
});

test('treats an initialized empty cloud as authoritative instead of resurrecting local data', () => {
  const cloud = { projects: [], studioProjects: [] };
  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: cloud, initialized: true, localWorkspace: { projects: [{ id: 'stale' }] } }), {
    workspace: cloud,
    shouldSeed: false,
  });
});

test('preserves local chats when an older initialized cloud payload omits chatThreads', () => {
  const localChats = [{ id: 'chat-local', messages: [] }];
  const cloud = { projects: [{ id: 'cloud' }], studioProjects: [] };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: { projects: [{ id: 'local' }], chatThreads: localChats },
  }), {
    workspace: { ...cloud, chatThreads: localChats },
    shouldSeed: false,
  });
});

test('keeps an explicit empty cloud chatThreads array authoritative', () => {
  const cloud = { projects: [{ id: 'cloud' }], studioProjects: [], chatThreads: [] };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: { projects: [{ id: 'local' }], chatThreads: [{ id: 'stale' }] },
  }), {
    workspace: cloud,
    shouldSeed: false,
  });
});

test('normalizes legacy raw project arrays before first cloud upload', () => {
  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: null, initialized: false, localWorkspace: [{ id: 'legacy' }] }), {
    workspace: { projects: [{ id: 'legacy' }], activeProjectId: '', studioProjects: [], activeStudioProjectId: '' },
    shouldSeed: true,
  });
});
