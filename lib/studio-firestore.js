/**
 * Collection layout — completely separate from the Fikr Flutter app:
 *
 *   studio_projects/{projectId}          { userId, name, archivedAt, createdAt, updatedAt }
 *   studio_notes/{noteId}                { projectId, userId, text, title, contentType, category,
 *                                          annotation, confidence, isEnriching, isError,
 *                                          fromMcp, fromSkill, isGhostNote,
 *                                          collapsedInProject, createdAt, updatedAt }
 *   studio_gen_projects/{projectId}      { userId, name, mode, platform, status, outputMarkdown,
 *                                          versions[], citations, error, createdAt, updatedAt }
 *
 * The Fikr Flutter app uses:  users/{uid}/notes/{noteId}   ← NEVER touch this here.
 *
 * All functions are called from main.js IPC handlers and executeTool().
 */

const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp }   = require('firebase-admin/firestore');
const path = require('path');

const PROJECTS     = 'studio_projects';
const NOTES        = 'studio_notes';
const GEN_PROJECTS = 'studio_gen_projects';

// ─── Firebase Admin init ──────────────────────────────────────────────────────

/**
 * Whether the app is running as a packaged production build.
 * - In packaged Electron: app.isPackaged === true
 * - In `npm run electron:dev` (dev): app.isPackaged === false
 * - Outside Electron (unit tests, scripts): fall back to NODE_ENV.
 */
function isProd() {
  try {
    const { app } = require('electron');
    return app.isPackaged;
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

/** Named Firestore DB: dev-fikr-studio (dev) or prod-fikr-studio (prod) */
const DB_NAME = () => isProd() ? 'prod-fikr-studio' : 'dev-fikr-studio';

// Cache one Firebase app + Firestore instance per databaseId to avoid
// re-initialising on every call (Admin SDK requirement for named databases).
const _dbCache = new Map();

function getAdminApp(appName) {
  const existing = getApps().find(a => a.name === appName);
  if (existing) return existing;
  const keyPath = path.join(__dirname, 'fikr-apps-firebase-adminsdk-fbsvc-fa29770e55.json');
  const keyExists = require('fs').existsSync(keyPath);
  console.log(`[Firestore] SA key path: ${keyPath} | exists: ${keyExists}`);
  try {
    const sa = require(keyPath);
    console.log(`[Firestore] Loaded SA key for project: ${sa.project_id}`);
    return initializeApp({ credential: cert(sa) }, appName);
  } catch (e) {
    console.error('[Firestore] SA key load FAILED, falling back to ADC:', e.message);
    return initializeApp({}, appName); // ADC in production
  }
}

function db() {
  const dbId = DB_NAME();
  if (_dbCache.has(dbId)) return _dbCache.get(dbId);
  const appName = `studio-db-${dbId}`;
  const adminApp = getAdminApp(appName);
  // Correct Admin SDK API for named databases: 2nd argument is the databaseId.
  // Do NOT use instance.settings({ databaseId }) — that is the client SDK pattern.
  const instance = getFirestore(adminApp, dbId);
  instance.settings({ ignoreUndefinedProperties: true });
  _dbCache.set(dbId, instance);
  console.log(`[Fikr Studio Firestore] Routing to database: ${dbId}`);
  return instance;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async function listProjects(userId) {
  try {
    const snap = await db()
      .collection(PROJECTS)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
    // Filter archived projects client-side to avoid requiring a composite index
    // on (userId, archivedAt, createdAt) in every named database instance.
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.archivedAt);
  } catch (e) {
    console.error('[Firestore] listProjects FULL ERROR:');
    console.error('  code:', e.code, '| message:', e.message);
    console.error('  details:', e.details);
    console.error('  metadata:', JSON.stringify(e.metadata));
    throw e;
  }
}

async function createProject(userId, name, customId) {
  const ref = customId
    ? db().collection(PROJECTS).doc(customId)
    : db().collection(PROJECTS).doc();
  await ref.set({
    userId,
    name,
    archivedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function renameProject(id, name) {
  await db().collection(PROJECTS).doc(id).update({ name, updatedAt: FieldValue.serverTimestamp() });
}

async function archiveProject(id) {
  // Soft-delete
  await db().collection(PROJECTS).doc(id).update({
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt:  FieldValue.serverTimestamp(),
  });
}

// ─── Notes ────────────────────────────────────────────────────────────────────

async function getNotesByProject(projectId) {
  const snap = await db()
    .collection(NOTES)
    .where('projectId', '==', projectId)
    .where('isGhostNote', '==', false)
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getGhostNotes(projectId) {
  const snap = await db()
    .collection(NOTES)
    .where('projectId', '==', projectId)
    .where('isGhostNote', '==', true)
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createNote({ id, projectId, userId, text, title, contentType, category, annotation,
                             confidence, isEnriching, isGhostNote, fromMcp, fromSkill }) {
  const ref = id
    ? db().collection(NOTES).doc(id)
    : db().collection(NOTES).doc();
  await ref.set({
    projectId,
    userId,
    text:               text ?? '',
    title:              title         ?? null,
    contentType:        contentType   ?? 'general',
    category:           category      ?? null,
    annotation:         annotation    ?? null,
    confidence:         confidence    ?? null,
    isEnriching:        isEnriching   ?? true,
    isError:            false,
    isGhostNote:        isGhostNote   ?? false,
    fromMcp:            fromMcp       ?? false,
    fromSkill:          fromSkill     ?? false,
    collapsedInProject: false,
    createdAt:          FieldValue.serverTimestamp(),
    updatedAt:          FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function updateNote({ id, text, title, contentType, category, annotation, confidence,
                             isEnriching, isError }) {
  const updates = { updatedAt: FieldValue.serverTimestamp() };
  if (text        !== undefined) updates.text        = text;
  if (title       !== undefined) updates.title       = title;
  if (contentType !== undefined) updates.contentType = contentType;
  if (category    !== undefined) updates.category    = category;
  if (annotation  !== undefined) updates.annotation  = annotation;
  if (confidence  !== undefined) updates.confidence  = confidence;
  if (isEnriching !== undefined) updates.isEnriching = isEnriching;
  if (isError     !== undefined) updates.isError     = isError;
  await db().collection(NOTES).doc(id).update(updates);
}

async function deleteNote(id) {
  await db().collection(NOTES).doc(id).delete();
}

async function deleteNotesByProject(projectId) {
  const snap = await db().collection(NOTES).where('projectId', '==', projectId).get();
  const batch = db().batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

async function setNoteCollapsed(id, collapsed) {
  await db().collection(NOTES).doc(id).update({ collapsedInProject: collapsed });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToMs(ts) {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds  === 'number')  return ts.seconds * 1000;
  return Date.now();
}

/**
 * Convert any timestamp representation to a JS Date safe for Firestore Admin SDK.
 * Handles:
 *  - Firestore Timestamp objects (from d.data())
 *  - Unix milliseconds (number, from Date.now() stored locally)
 *  - JS Date objects
 *  - null / undefined → null (caller should use FieldValue.serverTimestamp() as fallback)
 */
function toDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);         // Unix ms
  return null;
}

function normalizeNote(doc) {
  const d = doc.data ? doc.data() : doc;
  return {
    id:                 doc.id ?? d.id,
    text:               d.text        ?? '',
    title:              d.title       ?? null,
    contentType:        d.contentType ?? 'general',
    category:           d.category    ?? null,
    annotation:         d.annotation  ?? null,
    confidence:         d.confidence  ?? null,
    isEnriching:        d.isEnriching ?? false,
    isError:            d.isError     ?? false,
    fromMcp:            d.fromMcp     ?? false,
    fromSkill:          d.fromSkill   ?? false,
    timestamp:          tsToMs(d.createdAt),
    collapsedInProject: d.collapsedInProject ?? false,
  };
}

// ─── High-level workspace load / save (matches old workspace.json shape) ──────

/**
 * Load the full workspace for a user.
 * Returns: { activeProjectId, projects: [{ id, name, blocks, ghostNotes, collapsedIds }] }
 */
async function loadWorkspace(userId) {
  const projects = await listProjects(userId);
  const hydratedProjects = await Promise.all(
    projects.map(async (proj) => {
      const [blocks, ghostNotes] = await Promise.all([
        getNotesByProject(proj.id),
        getGhostNotes(proj.id),
      ]);
      return {
        id:          proj.id,
        name:        proj.name,
        collapsedIds: blocks.filter(b => b.collapsedInProject).map(b => b.id),
        blocks:       blocks.map(normalizeNote),
        ghostNotes:   ghostNotes.map(normalizeNote),
      };
    })
  );

  return {
    activeProjectId:       hydratedProjects[0]?.id ?? '',
    projects:              hydratedProjects,
    studioProjects:        await listGenProjects(userId),
    activeStudioProjectId: '',
  };
}

/**
 * Diff-save a full workspace to Firestore.
 * Receives same shape as workspace.json: { projects: [...], activeProjectId }
 * @param {Set<string>} [lastSyncedNoteIds] Baseline of note IDs seen on last cloud load — used
 *   to distinguish "deleted locally" from "created on another device". If not provided, deletions
 *   are skipped entirely (safe fallback).
 */
async function saveWorkspace(userId, workspace, lastSyncedNoteIds) {
  if (!workspace?.projects) return;
  const incomingProjects = workspace.projects;

  // Load current state for diffing
  let dbProjects;
  try {
    dbProjects = await listProjects(userId);
  } catch (err) {
    console.error('[Firestore] saveWorkspace: failed to load projects:', err.message);
    throw err;
  }

  const dbProjectIds       = new Set(dbProjects.map(p => p.id));
  const incomingProjectIds  = new Set(incomingProjects.map(p => p.id));

  // 1. Create new projects
  for (const proj of incomingProjects) {
    if (!dbProjectIds.has(proj.id)) {
      await createProject(userId, proj.name, proj.id);
      await _syncNotes(userId, proj.id, [], proj.blocks ?? [], proj.ghostNotes ?? [], lastSyncedNoteIds);
    }
  }

  // 2. Update existing projects
  for (const proj of incomingProjects) {
    if (!dbProjectIds.has(proj.id)) continue;
    const dbProj = dbProjects.find(p => p.id === proj.id);
    if (dbProj && dbProj.name !== proj.name) {
      await renameProject(proj.id, proj.name);
    }
    const [dbNotes, dbGhosts] = await Promise.all([
      getNotesByProject(proj.id),
      getGhostNotes(proj.id),
    ]);
    await _syncNotes(userId, proj.id, [...dbNotes, ...dbGhosts], proj.blocks ?? [], proj.ghostNotes ?? [], lastSyncedNoteIds);
  }

  // 3. Archive removed projects — only if we previously knew about them
  for (const dbProj of dbProjects) {
    if (!incomingProjectIds.has(dbProj.id)) {
      // Only archive if this project was in our last sync baseline (i.e., the user
      // intentionally deleted it locally rather than it being from another device).
      // If lastSyncedNoteIds is not provided we skip deletion entirely (safe fallback).
      if (lastSyncedNoteIds) {
        await deleteNotesByProject(dbProj.id);
        await archiveProject(dbProj.id);
      }
    }
  }

  // 4. Sync Studio generation projects (separate collection)
  if (workspace.studioProjects?.length > 0) {
    await _syncGenProjects(userId, workspace.studioProjects);
  }
}

async function _syncNotes(userId, projectId, dbNotes, blocks, ghostNotes, lastSyncedNoteIds) {
  const allIncoming = [
    ...blocks.map(b  => ({ ...b, isGhostNote: false })),
    ...ghostNotes.map(g => ({ ...g, isGhostNote: true  })),
  ];

  const dbNoteIds       = new Set(dbNotes.map(n => n.id));
  const incomingNoteIds = new Set(allIncoming.map(n => n.id).filter(Boolean));

  for (const note of allIncoming) {
    if (!note.id || !dbNoteIds.has(note.id)) {
      // New note — write with the local ID so it stays stable
      await createNote({
        id:          note.id,
        projectId,
        userId,
        text:        note.text,
        title:       note.title,
        contentType: note.contentType,
        category:    note.category,
        annotation:  note.annotation,
        confidence:  note.confidence,
        isEnriching: note.isEnriching ?? false,
        isGhostNote: note.isGhostNote ?? false,
        fromMcp:     note.fromMcp     ?? false,
        fromSkill:   note.fromSkill   ?? false,
      });
    } else {
      const dbNote     = dbNotes.find(n => n.id === note.id);
      const textChanged = dbNote?.text !== note.text;
      const metaChanged = (
        dbNote?.title       !== note.title       ||
        dbNote?.contentType !== note.contentType ||
        dbNote?.category    !== note.category    ||
        dbNote?.annotation  !== note.annotation  ||
        dbNote?.isEnriching !== note.isEnriching
      );
      if (textChanged || metaChanged) {
        await updateNote({
          id:          note.id,
          text:        note.text,
          title:       note.title,
          contentType: note.contentType,
          category:    note.category,
          annotation:  note.annotation,
          confidence:  note.confidence,
          isEnriching: note.isEnriching ?? false,
          isError:     note.isError     ?? false,
        });
      }
      const collapsed = blocks.find(b => b.id === note.id)?.collapsed ?? false;
      const rawNote = typeof dbNote.data === 'function' ? dbNote.data() : dbNote;
      if ((rawNote.collapsedInProject ?? false) !== collapsed) {
        await setNoteCollapsed(note.id, collapsed);
      }
    }
  }

  // Delete notes removed locally — ONLY if they were in our last sync baseline.
  // A note absent locally but NOT in lastSyncedNoteIds was created on another device;
  // we must not delete it.
  for (const dbNote of dbNotes) {
    if (!incomingNoteIds.has(dbNote.id)) {
      if (lastSyncedNoteIds && lastSyncedNoteIds.has(dbNote.id)) {
        await deleteNote(dbNote.id);
      }
      // else: note exists in cloud but wasn't in our baseline → another device created it → skip
    }
  }
}

// ─── Studio Generation Projects ───────────────────────────────────────────────

async function listGenProjects(userId) {
  const snap = await db()
    .collection(GEN_PROJECTS)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Upsert a single Studio generation project.
 * Versions are stored inline (array of { id, label, savedAt, markdown, wordCount, isManual }).
 * Markdown can be large — Firestore doc limit is 1MB so this is safe for reasonable content.
 */
async function upsertGenProject(userId, proj) {
  const ref = db().collection(GEN_PROJECTS).doc(proj.id);
  // Sanitise versions: strip any Firestore Timestamp objects from savedAt so
  // Firestore doesn't reject them when they are re-written as plain values.
  const versions = (proj.versions ?? []).map(v => ({
    ...v,
    savedAt: typeof v.savedAt === 'number' ? v.savedAt : tsToMs(v.savedAt),
  }));
  const createdDate = toDate(proj.createdAt);
  // Sanitise lastParams: ensure any nested timestamps are plain values.
  const lastParams = proj.lastParams ? { ...proj.lastParams } : null;
  await ref.set({
    userId,
    name:           proj.name           ?? 'Untitled',
    mode:           proj.mode           ?? 'article',
    platform:       proj.platform       ?? 'linkedin',
    status:         proj.status         ?? 'ideating',
    outputMarkdown: proj.outputMarkdown ?? '',
    versions,
    citations:      proj.citations      ?? [],
    error:          proj.error          ?? null,
    // Generation parameters — persisted so they survive across devices/reloads
    tone:             proj.tone             ?? 50,
    depth:            proj.depth            ?? 50,
    audience:         proj.audience         ?? 50,
    presetId:         proj.presetId         ?? null,
    maxLength:        proj.maxLength        ?? null,
    enableHashtags:   proj.enableHashtags   ?? null,
    lastParams,
    createdAt:      createdDate ?? FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function deleteGenProject(id) {
  await db().collection(GEN_PROJECTS).doc(id).delete();
}

/**
 * Diff-sync Studio generation projects.
 * New/changed projects are upserted; projects missing from incoming are deleted.
 */
async function _syncGenProjects(userId, incomingProjects) {
  const snap = await db().collection(GEN_PROJECTS).where('userId', '==', userId).get();
  const dbIds       = new Set(snap.docs.map(d => d.id));
  const incomingIds = new Set(incomingProjects.map(p => p.id));

  // Upsert new or changed projects
  for (const proj of incomingProjects) {
    const dbDoc = snap.docs.find(d => d.id === proj.id);
    const dbData = dbDoc?.data();
    const changed = !dbDoc ||
      dbData?.name           !== proj.name           ||
      dbData?.status         !== proj.status         ||
      dbData?.platform       !== proj.platform       ||
      dbData?.outputMarkdown !== proj.outputMarkdown ||
      (dbData?.versions?.length ?? 0) !== (proj.versions?.length ?? 0) ||
      // Generation parameter changes
      dbData?.tone           !== proj.tone           ||
      dbData?.depth          !== proj.depth          ||
      dbData?.audience       !== proj.audience       ||
      dbData?.presetId       !== proj.presetId       ||
      dbData?.maxLength      !== proj.maxLength      ||
      dbData?.enableHashtags !== proj.enableHashtags ||
      JSON.stringify(dbData?.lastParams) !== JSON.stringify(proj.lastParams ?? null);
    if (changed) {
      await upsertGenProject(userId, proj);
    }
  }

  // Delete projects removed locally
  for (const doc of snap.docs) {
    if (!incomingIds.has(doc.id)) {
      await deleteGenProject(doc.id);
    }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  loadWorkspace,
  saveWorkspace,
  listProjects,
  createProject,
  renameProject,
  archiveProject,
  getNotesByProject,
  getGhostNotes,
  createNote,
  updateNote,
  deleteNote,
  deleteNotesByProject,
  setNoteCollapsed,
  listGenProjects,
  upsertGenProject,
  deleteGenProject,
};
