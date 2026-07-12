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

function selectFirstSyncWorkspace({ cloudWorkspace, initialized, localWorkspace }) {
  if (initialized) return { workspace: normalizeWorkspace(cloudWorkspace), shouldSeed: false };
  const local = normalizeWorkspace(localWorkspace);
  if (hasWorkspaceData(local)) return { workspace: local, shouldSeed: true };
  return { workspace: normalizeWorkspace(cloudWorkspace), shouldSeed: false };
}

module.exports = { hasWorkspaceData, normalizeWorkspace, selectFirstSyncWorkspace };
