const test = require('node:test');
const assert = require('node:assert/strict');
const { CHAT_CREATION_RECOVERY_KIND, selectFirstSyncWorkspace } = require('../lib/cloud-seed');

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

test('preserves local creations when a legacy cloud endpoint cannot persist them', () => {
  const localCreations = [{ id: 'local-creation' }];
  const cloud = { projects: [{ id: 'cloud' }], studioProjects: [] };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: {
      projects: [{ id: 'local' }],
      studioProjects: localCreations,
      activeStudioProjectId: 'local-creation',
    },
  }), {
    workspace: {
      ...cloud,
      studioProjects: localCreations,
      activeStudioProjectId: 'local-creation',
    },
    shouldSeed: false,
  });
});

test('legacy initialized cloud preserves the complete 43 note 12 chat and 7 creation baseline', () => {
  const cloudProjects = Array.from({ length: 8 }, (_, projectIndex) => ({
    id: `cloud-project-${projectIndex}`,
    blocks: Array.from({ length: projectIndex === 7 ? 8 : 5 }, (_, noteIndex) => ({
      id: `note-${projectIndex}-${noteIndex}`,
    })),
  }));
  const local = {
    projects: [{ id: 'stale-local-project', blocks: [] }],
    chatThreads: Array.from({ length: 12 }, (_, index) => ({ id: `chat-${index}` })),
    studioProjects: Array.from({ length: 7 }, (_, index) => ({ id: `creation-${index}` })),
    activeStudioProjectId: 'creation-3',
  };
  const cloud = {
    projects: cloudProjects,
    activeProjectId: cloudProjects[0].id,
    studioProjects: [],
  };

  const selected = selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: local,
  });

  assert.equal(selected.workspace.projects.flatMap((project) => project.blocks).length, 43);
  assert.equal(selected.workspace.chatThreads.length, 12);
  assert.equal(selected.workspace.studioProjects.length, 7);
  assert.equal(selected.workspace.activeStudioProjectId, 'creation-3');
  assert.equal(selected.shouldSeed, false);
});

test('treats an explicit empty creation list as authoritative once cloud schema v2 creation sync is initialized', () => {
  const cloud = {
    workspaceSchemaVersion: 2,
    creationSyncInitialized: true,
    projects: [{ id: 'cloud' }],
    studioProjects: [],
  };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: { projects: [{ id: 'local' }], studioProjects: [{ id: 'stale-creation' }] },
  }), {
    workspace: cloud,
    shouldSeed: false,
  });
});

test('preserves local creations during a schema v2 creation-sync migration', () => {
  const localCreations = [{ id: 'creation-to-migrate' }];
  const cloud = {
    workspaceSchemaVersion: 2,
    creationSyncInitialized: false,
    projects: [{ id: 'cloud' }],
    studioProjects: [],
  };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: { studioProjects: localCreations },
  }), {
    workspace: { ...cloud, studioProjects: localCreations, activeStudioProjectId: '' },
    shouldSeed: false,
  });
});

test('one-time recovery intent restores only chats and creations into an initialized cloud workspace', () => {
  const cloud = {
    projects: [{ id: 'cloud-note-project' }],
    activeProjectId: 'cloud-note-project',
    studioProjects: [],
    chatThreads: [{ id: 'cloud-chat' }],
    cloudOnlyField: 'preserved',
  };
  const local = {
    projects: [{ id: 'stale-local-project' }],
    chatThreads: [{ id: 'recovered-chat' }],
    studioProjects: [{ id: 'recovered-creation' }],
    activeStudioProjectId: 'recovered-creation',
    recoveryIntent: {
      kind: CHAT_CREATION_RECOVERY_KIND,
      requestedAt: 1787732887000,
    },
    localOnlyField: 'must-not-upload',
  };

  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: cloud, initialized: true, localWorkspace: local }), {
    workspace: {
      ...cloud,
      chatThreads: local.chatThreads,
      studioProjects: local.studioProjects,
      activeStudioProjectId: 'recovered-creation',
    },
    shouldSeed: true,
    recoveryApplied: true,
  });
});

test('malformed recovery intent cannot override explicit initialized cloud chats', () => {
  const cloud = { projects: [{ id: 'cloud' }], studioProjects: [], chatThreads: [] };
  const local = {
    projects: [{ id: 'local' }],
    chatThreads: [{ id: 'duplicate' }, { id: 'duplicate' }],
    studioProjects: [{ id: 'creation' }],
    recoveryIntent: { kind: CHAT_CREATION_RECOVERY_KIND, requestedAt: 1787732887000 },
  };

  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: cloud, initialized: true, localWorkspace: local }), {
    workspace: {
      ...cloud,
      studioProjects: local.studioProjects,
      activeStudioProjectId: '',
    },
    shouldSeed: false,
  });
});

test('preserves local chat memories when the cloud schema omits them', () => {
  const localMemories = [{ id: 'memory-local', text: 'I prefer concise answers.' }];
  const cloud = { projects: [{ id: 'cloud' }], studioProjects: [] };

  assert.deepEqual(selectFirstSyncWorkspace({
    cloudWorkspace: cloud,
    initialized: true,
    localWorkspace: { projects: [{ id: 'local' }], chatMemories: localMemories },
  }), {
    workspace: { ...cloud, chatMemories: localMemories },
    shouldSeed: false,
  });
});

test('normalizes legacy raw project arrays before first cloud upload', () => {
  assert.deepEqual(selectFirstSyncWorkspace({ cloudWorkspace: null, initialized: false, localWorkspace: [{ id: 'legacy' }] }), {
    workspace: { projects: [{ id: 'legacy' }], activeProjectId: '', studioProjects: [], activeStudioProjectId: '' },
    shouldSeed: true,
  });
});
