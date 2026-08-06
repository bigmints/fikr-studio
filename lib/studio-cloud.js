/**
 * Authenticated Fikr Studio cloud-sync client.
 *
 * Firebase Admin credentials belong exclusively on fikr.one. The desktop sends
 * a Firebase ID token; fikr.one verifies it, derives the UID, checks the user's
 * subscription plan, and scopes every Firestore operation to that UID.
 */

function createStudioCloudClient({
  baseUrl = process.env.FIKR_API_BASE_URL || 'https://fikr.one',
  fetchImpl = globalThis.fetch,
} = {}) {
async function request(path, idToken, options = {}) {
  if (!idToken) throw new Error('Authentication required');
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');
  const response = await fetchImpl(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Fikr API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function getCurrentUser(idToken) {
  return request('/api/user/me', idToken);
}

async function loadWorkspaceState(idToken) {
  const payload = await request('/api/studio/workspace', idToken);
  return { workspace: payload.workspace ?? null, initialized: Boolean(payload.initialized) };
}

async function loadWorkspace(idToken) {
  return (await loadWorkspaceState(idToken)).workspace;
}

async function getRelayKey(idToken) {
  return request('/api/mcp/keys', idToken);
}

async function consumeRelay(idToken) {
  return request('/api/studio/relay', idToken);
}

async function acknowledgeRelay(idToken, id, leaseToken, outcome) {
  return request('/api/studio/relay', idToken, {
    method: 'POST',
    body: JSON.stringify({ id, leaseToken, ...outcome }),
  });
}

async function leaseExternalMessages(idToken, limit = 5) {
  return request('/api/relay/v1/messages/lease', idToken, {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

async function acknowledgeExternalMessage(idToken, id, leaseToken, result) {
  return request(`/api/relay/v1/messages/${encodeURIComponent(id)}/ack`, idToken, {
    method: 'POST',
    body: JSON.stringify({ leaseToken, result }),
  });
}

async function rejectExternalMessage(idToken, id, leaseToken, error) {
  return request(`/api/relay/v1/messages/${encodeURIComponent(id)}/nack`, idToken, {
    method: 'POST',
    body: JSON.stringify({ leaseToken, error }),
  });
}

async function saveWorkspace(
  idToken,
  workspace,
  lastSyncedNoteIds,
  lastSyncedProjectIds,
  lastSyncedGenProjectIds,
) {
  return request('/api/studio/workspace', idToken, {
    method: 'PUT',
    body: JSON.stringify({
      workspace,
      baseline: {
        noteIds: Array.from(lastSyncedNoteIds ?? []),
        projectIds: Array.from(lastSyncedProjectIds ?? []),
        genProjectIds: Array.from(lastSyncedGenProjectIds ?? []),
      },
    }),
  });
}

return {
  getCurrentUser,
  getRelayKey,
  consumeRelay,
  acknowledgeRelay,
  leaseExternalMessages,
  acknowledgeExternalMessage,
  rejectExternalMessage,
  loadWorkspace,
  loadWorkspaceState,
  saveWorkspace,
};
}

const defaultClient = createStudioCloudClient();
module.exports = { ...defaultClient, createStudioCloudClient };
