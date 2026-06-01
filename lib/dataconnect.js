/**
 * Fikr Studio — Data Connect Layer
 *
 * Server-side (Electron main process) data access layer for Firebase Data Connect.
 * Replaces the previous local workspace.json flat-file storage.
 *
 * All calls go through the Firebase Data Connect REST API using the Admin SDK
 * credentials. The userId is derived from the verified Firebase Auth ID token
 * stored in Electron's safeStorage after SSO login.
 *
 * Embedding vectors (384-dim from @xenova/transformers) are stored separately
 * in the local workspace.json cache alongside the note ID — we don't send them
 * over the Data Connect REST API to keep payloads small. A future migration can
 * push them to a Cloud SQL pgvector column when needed.
 */

const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getDataConnect, queryRef, mutationRef, executeQuery, executeMutation } = require('firebase-admin/data-connect');
const path = require('path');

// ─── Firebase Admin init ──────────────────────────────────────────────────────
// Uses the same service account key as fikr.one for consistency.
// Falls back to Application Default Credentials (ADC) in production builds.

function getAdminApp() {
  if (getApps().length > 0) return getApp();
  const keyPath = path.join(__dirname, 'fikr-apps-firebase-adminsdk-fbsvc-fa29770e55.json');
  try {
    // Try to load the service account key (dev environment)
    const serviceAccount = require(keyPath);
    return initializeApp({ credential: cert(serviceAccount) });
  } catch {
    // Production: use ADC (Cloud Run / GCE)
    return initializeApp();
  }
}

// ─── Data Connect client ──────────────────────────────────────────────────────
const DATA_CONNECT_CONFIG = {
  serviceId: 'fikr-apps-service',
  location:  'us-central1',
  connectorId: 'studio-connector',
};

function getDC() {
  const adminApp = getAdminApp();
  return getDataConnect(adminApp, DATA_CONNECT_CONFIG);
}

// ─── Types (JSDoc for IDE support without TypeScript in main.js) ──────────────
/**
 * @typedef {{ id: string, name: string, createdAt: string, updatedAt: string }} DCProject
 * @typedef {{
 *   id: string, text: string, contentType: string, category: string,
 *   annotation: string, confidence: number, isEnriching: boolean,
 *   isError: boolean, fromMcp: boolean, fromSkill: boolean,
 *   collapsedInProject: boolean, createdAt: string, updatedAt: string
 * }} DCNote
 */

// ─── Projects ─────────────────────────────────────────────────────────────────

/**
 * List all active (non-archived) projects owned by a user.
 * @param {string} userId
 * @returns {Promise<DCProject[]>}
 */
async function listProjects(userId) {
  const dc = getDC();
  const ref = queryRef(dc, 'ListProjects', { userId });
  const result = await executeQuery(ref);
  return result.data?.studioProjects ?? [];
}

/**
 * Create a new project for a user.
 * @param {string} userId
 * @param {string} name
 * @returns {Promise<string>} The new project ID
 */
async function createProject(userId, name) {
  const dc = getDC();
  const ref = mutationRef(dc, 'CreateProject', { userId, name });
  const result = await executeMutation(ref);
  return result.data?.studioProject_insert?.id ?? null;
}

/**
 * Rename an existing project.
 * @param {string} id
 * @param {string} name
 */
async function renameProject(id, name) {
  const dc = getDC();
  const ref = mutationRef(dc, 'RenameProject', { id, name });
  await executeMutation(ref);
}

/**
 * Soft-delete (archive) a project and all its notes.
 * @param {string} id
 */
async function archiveProject(id) {
  const dc = getDC();
  // Delete all notes first to keep referential integrity clean
  await executeMutation(mutationRef(dc, 'DeleteNotesByProject', { projectId: id }));
  // Then archive the project
  await executeMutation(mutationRef(dc, 'ArchiveProject', { id }));
}

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * Get all canvas notes (non-ghost) for a project.
 * @param {string} projectId
 * @returns {Promise<DCNote[]>}
 */
async function getNotesByProject(projectId) {
  const dc = getDC();
  const ref = queryRef(dc, 'GetNotesByProject', { projectId });
  const result = await executeQuery(ref);
  return result.data?.studioNotes ?? [];
}

/**
 * Get synthesis/ghost notes for a project.
 * @param {string} projectId
 * @returns {Promise<DCNote[]>}
 */
async function getGhostNotes(projectId) {
  const dc = getDC();
  const ref = queryRef(dc, 'GetGhostNotes', { projectId });
  const result = await executeQuery(ref);
  return result.data?.studioNotes ?? [];
}

/**
 * Create a new note in a project.
 * @param {object} opts
 * @returns {Promise<string>} New note ID
 */
async function createNote({ projectId, userId, text, contentType, category, annotation, confidence, isEnriching, isGhostNote, fromMcp, fromSkill }) {
  const dc = getDC();
  const ref = mutationRef(dc, 'CreateNote', {
    projectId,
    userId,
    text,
    contentType: contentType ?? 'general',
    category: category ?? null,
    annotation: annotation ?? null,
    confidence: confidence ?? null,
    isEnriching: isEnriching ?? true,
    isGhostNote: isGhostNote ?? false,
    fromMcp: fromMcp ?? false,
    fromSkill: fromSkill ?? false,
  });
  const result = await executeMutation(ref);
  return result.data?.studioNote_insert?.id ?? null;
}

/**
 * Update an existing note's content and enrichment state.
 * @param {object} opts
 */
async function updateNote({ id, text, contentType, category, annotation, confidence, isEnriching, isError }) {
  const dc = getDC();
  const ref = mutationRef(dc, 'UpdateNote', {
    id,
    text,
    contentType: contentType ?? null,
    category: category ?? null,
    annotation: annotation ?? null,
    confidence: confidence ?? null,
    isEnriching: isEnriching ?? false,
    isError: isError ?? false,
  });
  await executeMutation(ref);
}

/**
 * Hard-delete a note.
 * @param {string} id
 */
async function deleteNote(id) {
  const dc = getDC();
  const ref = mutationRef(dc, 'DeleteNote', { id });
  await executeMutation(ref);
}

/**
 * Set the collapsed state of a note in the canvas.
 * @param {string} id
 * @param {boolean} collapsed
 */
async function setNoteCollapsed(id, collapsed) {
  const dc = getDC();
  const ref = mutationRef(dc, 'SetNoteCollapsed', { id, collapsed });
  await executeMutation(ref);
}

// ─── Full workspace load / save ───────────────────────────────────────────────
// These are the high-level functions called by the IPC handlers in main.js.
// They replicate the shape previously held by workspace.json so the React app
// requires zero changes.

/**
 * Load the full workspace for a user from Data Connect.
 * Returns the same shape as the old workspace.json:
 * { activeProjectId, projects: [{ id, name, blocks, ghostNotes, collapsedIds }] }
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function loadWorkspace(userId) {
  try {
    const projects = await listProjects(userId);
    const hydratedProjects = await Promise.all(
      projects.map(async (proj) => {
        const [blocks, ghostNotes] = await Promise.all([
          getNotesByProject(proj.id),
          getGhostNotes(proj.id),
        ]);
        return {
          id: proj.id,
          name: proj.name,
          collapsedIds: blocks.filter(b => b.collapsedInProject).map(b => b.id),
          blocks: blocks.map(normalizeNote),
          ghostNotes: ghostNotes.map(normalizeNote),
        };
      })
    );

    return {
      activeProjectId: hydratedProjects[0]?.id ?? '',
      projects: hydratedProjects,
    };
  } catch (err) {
    console.error('[DataConnect] loadWorkspace failed:', err.message);
    return null;
  }
}

/**
 * Save a full workspace diff to Data Connect.
 * Receives the same workspace object shape that was previously written to disk.
 * Uses a diff strategy: compare incoming projects+notes against a fresh read,
 * then insert/update/delete accordingly.
 *
 * For performance, this function is intentionally not atomic — it operates
 * record-by-record. A future optimisation can batch mutations.
 *
 * @param {string} userId
 * @param {object} workspace  { projects: [...], activeProjectId: string }
 * @param {object} [lastSyncedNoteIds]  Set of previously synced note IDs for safe deletion diffing
 */
async function saveWorkspace(userId, workspace, lastSyncedNoteIds) {
  if (!workspace?.projects) return;
  const incomingProjects = workspace.projects;

  // Load current state from DB for diffing
  let dbProjects;
  try {
    dbProjects = await listProjects(userId);
  } catch (err) {
    console.error('[DataConnect] saveWorkspace: failed to load current projects:', err.message);
    throw err;
  }

  const dbProjectIds = new Set(dbProjects.map(p => p.id));
  const incomingProjectIds = new Set(incomingProjects.map(p => p.id));

  // ── 1. Create new projects ───────────────────────────────────────────
  for (const proj of incomingProjects) {
    if (!dbProjectIds.has(proj.id)) {
      // New project — create it and all its notes
      const newId = await createProject(userId, proj.name);
      // Map old local ID → new DB ID for note creation
      const idMap = { [proj.id]: newId };
      await _syncNotes(userId, newId, [], proj.blocks ?? [], proj.ghostNotes ?? [], lastSyncedNoteIds);
    }
  }

  // ── 2. Update existing projects ──────────────────────────────────────
  for (const proj of incomingProjects) {
    if (!dbProjectIds.has(proj.id)) continue; // already handled above

    const dbProj = dbProjects.find(p => p.id === proj.id);

    // Rename if name changed
    if (dbProj && dbProj.name !== proj.name) {
      await renameProject(proj.id, proj.name);
    }

    // Sync notes
    const [dbNotes, dbGhosts] = await Promise.all([
      getNotesByProject(proj.id),
      getGhostNotes(proj.id),
    ]);
    await _syncNotes(userId, proj.id, [...dbNotes, ...dbGhosts], proj.blocks ?? [], proj.ghostNotes ?? [], lastSyncedNoteIds);
  }

  // ── 3. Archive removed projects ──────────────────────────────────────
  for (const dbProj of dbProjects) {
    if (!incomingProjectIds.has(dbProj.id)) {
      await archiveProject(dbProj.id);
    }
  }
}

/**
 * Internal: diff and sync the notes of one project.
 * @param {string} userId
 * @param {string} projectId
 * @param {DCNote[]} dbNotes      Current notes in DB
 * @param {object[]} blocks       Incoming regular notes
 * @param {object[]} ghostNotes   Incoming ghost/synthesis notes
 * @param {Set<string>} lastSyncedNoteIds Baseline sync state
 */
async function _syncNotes(userId, projectId, dbNotes, blocks, ghostNotes, lastSyncedNoteIds) {
  const allIncoming = [
    ...blocks.map(b => ({ ...b, isGhostNote: false })),
    ...ghostNotes.map(g => ({ ...g, isGhostNote: true })),
  ];

  const dbNoteIds = new Set(dbNotes.map(n => n.id));
  const incomingNoteIds = new Set(allIncoming.map(n => n.id).filter(Boolean));

  // Create notes that don't exist in DB yet (skip those with no ID — new local ones)
  for (const note of allIncoming) {
    if (!note.id || !dbNoteIds.has(note.id)) {
      await createNote({
        projectId,
        userId,
        text: note.text,
        contentType: note.contentType,
        category: note.category,
        annotation: note.annotation,
        confidence: note.confidence,
        isEnriching: note.isEnriching ?? false,
        isGhostNote: note.isGhostNote ?? false,
        fromMcp: note.fromMcp ?? false,
        fromSkill: note.fromSkill ?? false,
      });
    } else {
      // Update notes that already exist
      const dbNote = dbNotes.find(n => n.id === note.id);
      const textChanged = dbNote?.text !== note.text;
      const metaChanged = (
        dbNote?.contentType !== note.contentType ||
        dbNote?.category !== note.category ||
        dbNote?.annotation !== note.annotation ||
        dbNote?.isEnriching !== note.isEnriching
      );

      if (textChanged || metaChanged) {
        await updateNote({
          id: note.id,
          text: note.text,
          contentType: note.contentType,
          category: note.category,
          annotation: note.annotation,
          confidence: note.confidence,
          isEnriching: note.isEnriching ?? false,
          isError: note.isError ?? false,
        });
      }

      // Sync collapsed state
      const collapsed = (blocks.find(b => b.id === note.id)?.collapsed) ?? false;
      if (dbNote?.collapsedInProject !== collapsed) {
        await setNoteCollapsed(note.id, collapsed);
      }
    }
  }

  // Delete notes removed from local state, BUT ONLY IF they were previously synced
  for (const dbNote of dbNotes) {
    if (!incomingNoteIds.has(dbNote.id)) {
      if (lastSyncedNoteIds && lastSyncedNoteIds.has(dbNote.id)) {
        await deleteNote(dbNote.id);
      }
    }
  }
}

/**
 * Normalise a Data Connect note record into the shape the React app expects.
 * @param {DCNote} note
 * @returns {object}
 */
function normalizeNote(note) {
  return {
    id: note.id,
    text: note.text,
    contentType: note.contentType ?? 'general',
    category: note.category ?? null,
    annotation: note.annotation ?? null,
    confidence: note.confidence ?? null,
    isEnriching: note.isEnriching ?? false,
    isError: note.isError ?? false,
    fromMcp: note.fromMcp ?? false,
    fromSkill: note.fromSkill ?? false,
    timestamp: new Date(note.createdAt).getTime(),
    // embedding intentionally omitted — stored in local cache
  };
}

// ─── Bulk import (migration from workspace.json) ──────────────────────────────

/**
 * One-shot import of a legacy workspace.json into Data Connect.
 * Called on first launch after the update.
 * Each project and note is inserted only if it doesn't already exist.
 *
 * @param {string} userId
 * @param {object} legacyWorkspace  The parsed workspace.json object
 */
async function importLegacyWorkspace(userId, legacyWorkspace) {
  const projects = Array.isArray(legacyWorkspace)
    ? legacyWorkspace
    : (legacyWorkspace?.projects ?? []);

  if (projects.length === 0) return;
  console.log(`[DataConnect] Importing ${projects.length} legacy projects for user ${userId}`);

  // Fetch what's already in DB so we don't duplicate
  const existing = await listProjects(userId);
  const existingNames = new Set(existing.map(p => p.name));

  for (const proj of projects) {
    if (existingNames.has(proj.name)) {
      console.log(`[DataConnect] Skipping already-imported project: ${proj.name}`);
      continue;
    }

    const newProjectId = await createProject(userId, proj.name);
    console.log(`[DataConnect] Created project "${proj.name}" → ${newProjectId}`);

    const allNotes = [
      ...(proj.blocks ?? []).map(b => ({ ...b, isGhostNote: false })),
      ...(proj.ghostNotes ?? []).map(g => ({ ...g, isGhostNote: true })),
    ];

    for (const note of allNotes) {
      if (!note.text?.trim()) continue;
      await createNote({
        projectId: newProjectId,
        userId,
        text: note.text,
        contentType: note.contentType,
        category: note.category,
        annotation: note.annotation,
        confidence: note.confidence,
        isEnriching: false,  // don't re-enrich on import
        isGhostNote: note.isGhostNote,
        fromMcp: note.fromMcp ?? false,
        fromSkill: note.fromSkill ?? false,
      });
    }

    console.log(`[DataConnect] Imported ${allNotes.length} notes into "${proj.name}"`);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  loadWorkspace,
  saveWorkspace,
  importLegacyWorkspace,
  listProjects,
  createProject,
  renameProject,
  archiveProject,
  getNotesByProject,
  getGhostNotes,
  createNote,
  updateNote,
  deleteNote,
  setNoteCollapsed,
};
