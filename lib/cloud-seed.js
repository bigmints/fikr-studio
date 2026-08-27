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

const CHAT_CREATION_RECOVERY_KIND = 'restore-chat-threads-and-creations-v1';
const MAX_RECOVERY_ITEMS = 500;

function isBoundedIdentifiedList(value) {
  if (!Array.isArray(value) || value.length > MAX_RECOVERY_ITEMS) return false;
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 240 || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

function hasApprovedChatCreationRecovery(localWorkspace) {
  const local = normalizeWorkspace(localWorkspace);
  const intent = local?.recoveryIntent;
  return Boolean(
    intent
    && typeof intent === 'object'
    && !Array.isArray(intent)
    && intent.kind === CHAT_CREATION_RECOVERY_KIND
    && Number.isSafeInteger(intent.requestedAt)
    && intent.requestedAt > 0
    && isBoundedIdentifiedList(local.chatThreads)
    && isBoundedIdentifiedList(local.studioProjects)
  );
}

function applyApprovedChatCreationRecovery(cloudWorkspace, localWorkspace) {
  const cloud = preserveLocalFieldsMissingFromCloud(cloudWorkspace, localWorkspace);
  const local = normalizeWorkspace(localWorkspace);
  if (!cloud || !local || !hasApprovedChatCreationRecovery(local)) return cloud;
  const { recoveryIntent: _discardedIntent, ...cloudWithoutIntent } = cloud;
  const activeStudioProjectId = local.studioProjects.some((creation) => creation.id === local.activeStudioProjectId)
    ? local.activeStudioProjectId
    : '';
  return {
    ...cloudWithoutIntent,
    chatThreads: local.chatThreads,
    studioProjects: local.studioProjects,
    activeStudioProjectId,
  };
}

function preserveLocalFieldsMissingFromCloud(cloudWorkspace, localWorkspace) {
  const cloud = normalizeWorkspace(cloudWorkspace);
  const local = normalizeWorkspace(localWorkspace);
  if (!cloud || !local) return cloud;
  let merged = cloud;

  // Chat history was added after the original cloud-workspace schema. Older
  // server payloads omit the field instead of returning an empty array. An
  // omitted field means "not represented by this payload", while an explicit
  // empty array remains authoritative and must continue to support deletion.
  if (!Object.prototype.hasOwnProperty.call(cloud, 'chatThreads') && Array.isArray(local.chatThreads)) {
    merged = { ...merged, chatThreads: local.chatThreads };
  }

  // Older deployed workspace endpoints returned an explicit empty
  // studioProjects array even though they did not persist creations on PUT.
  // Preserve a non-empty local collection until the server advertises the
  // schema that makes an explicit empty array authoritative.
  const cloudSchemaVersion = Number.isSafeInteger(cloud.workspaceSchemaVersion)
    ? cloud.workspaceSchemaVersion
    : 0;
  const creationSyncIsAuthoritative = cloudSchemaVersion >= 2 && cloud.creationSyncInitialized === true;
  if (!creationSyncIsAuthoritative
      && isBoundedIdentifiedList(local.studioProjects)
      && local.studioProjects.length > 0
      && (!Array.isArray(cloud.studioProjects) || cloud.studioProjects.length === 0)) {
    merged = {
      ...merged,
      studioProjects: local.studioProjects,
      activeStudioProjectId: local.studioProjects.some((creation) => creation.id === local.activeStudioProjectId)
        ? local.activeStudioProjectId
        : '',
    };
  }

  // Durable chat memories are local-first until the Studio cloud schema owns
  // them explicitly. A cloud payload that omits the field must not erase the
  // user's local continuity state during sign-in or refresh.
  if (!Object.prototype.hasOwnProperty.call(cloud, 'chatMemories') && Array.isArray(local.chatMemories)) {
    merged = { ...merged, chatMemories: local.chatMemories };
  }

  return merged;
}

function selectFirstSyncWorkspace({ cloudWorkspace, initialized, localWorkspace }) {
  if (initialized) {
    if (hasApprovedChatCreationRecovery(localWorkspace)) {
      return {
        workspace: applyApprovedChatCreationRecovery(cloudWorkspace, localWorkspace),
        shouldSeed: true,
        recoveryApplied: true,
      };
    }
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
  CHAT_CREATION_RECOVERY_KIND,
  applyApprovedChatCreationRecovery,
  hasApprovedChatCreationRecovery,
  hasWorkspaceData,
  normalizeWorkspace,
  preserveLocalFieldsMissingFromCloud,
  selectFirstSyncWorkspace,
};
