function normalizeWorkspace(workspace) {
  if (Array.isArray(workspace)) return { projects: workspace, activeProjectId: '', studioProjects: [], activeStudioProjectId: '' };
  return workspace && typeof workspace === 'object' ? workspace : null;
}

function hasWorkspaceData(workspace) {
  const normalized = normalizeWorkspace(workspace);
  return Boolean(normalized && (
    (Array.isArray(normalized.projects) && normalized.projects.length > 0) ||
    (Array.isArray(normalized.studioProjects) && normalized.studioProjects.length > 0)
  ));
}

function preserveLocalFieldsMissingFromCloud(cloudWorkspace, localWorkspace) {
  const cloud = normalizeWorkspace(cloudWorkspace);
  const local = normalizeWorkspace(localWorkspace);
  if (!cloud || !local) return cloud;

  // Chat history was added after the original cloud-workspace schema. Older
  // server payloads omit the field instead of returning an empty array. An
  // omitted field means "not represented by this payload", while an explicit
  // empty array remains authoritative and must continue to support deletion.
  if (!Object.prototype.hasOwnProperty.call(cloud, 'chatThreads') && Array.isArray(local.chatThreads)) {
    return { ...cloud, chatThreads: local.chatThreads };
  }

  return cloud;
}

function selectFirstSyncWorkspace({ cloudWorkspace, initialized, localWorkspace }) {
  if (initialized) {
    return {
      workspace: preserveLocalFieldsMissingFromCloud(cloudWorkspace, localWorkspace),
      shouldSeed: false,
    };
  }
  const local = normalizeWorkspace(localWorkspace);
  if (hasWorkspaceData(local)) return { workspace: local, shouldSeed: true };
  return { workspace: normalizeWorkspace(cloudWorkspace), shouldSeed: false };
}

module.exports = {
  hasWorkspaceData,
  normalizeWorkspace,
  preserveLocalFieldsMissingFromCloud,
  selectFirstSyncWorkspace,
};
