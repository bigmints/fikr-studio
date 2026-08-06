const { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray, nativeImage, safeStorage, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { randomBytes } = require('crypto');
const { consumeAuthCallback } = require('./lib/auth-callback');
const { isAuthorizedMcpRequest: authorizeMcpRequest } = require('./lib/mcp-auth');
const { createWorkspaceStore } = require('./lib/workspace-store');
const { updateJsonConfig } = require('./lib/json-config-store');
const { performAiRequest } = require('./lib/ai-request');
const { clearLocalFiles } = require('./lib/local-data');
const { selectFirstSyncWorkspace } = require('./lib/cloud-seed');
const { embedRelevanceVector } = require('./lib/relevance-vectors');
const { validateMcpRpc, validateToolCall } = require('./lib/mcp-validation');
const { externalRelayMessageToRpc } = require('./lib/external-relay-message');
const { configureSafeStorageProfile } = require('./lib/secure-storage-profile');
const { loadOrCreateLocalMcpAuthToken } = require('./lib/local-mcp-auth');
const { installDownloadedUpdate } = require('./lib/update-install');
const { sendUpdateStatus } = require('./lib/update-status');

// ─── Authenticated cloud-sync client ─────────────────────────────────────────
// Firebase Admin credentials remain on fikr.one; the desktop sends only an ID token.
const dc = require('./lib/studio-cloud');

/** Firebase UID of the currently signed-in user (null = offline / Free) */
let currentUserId = null;

/** Firebase ID token for calling fikr.one APIs (refreshed on auth state change) */
let currentIdToken = null;
let currentAccountProfile = null;

/** True after the renderer has reported the current Firebase auth state. */
let authStateResolved = false;

/**
 * True once runStartupSequence() has finished.
 * During startup, set-user feeds auth into the sequence but skips the
 * post-auth cloud load (runStartupSequence handles that itself).
 */
let isStartupComplete = false;

/**
 * True once the startup cloud load has completed (or we confirmed user is offline/Free).
 * Blocks all cloud saves until we know what the server-authorized state is.
 * Without this gate the renderer's initial disk-state save fires before the cloud
 * data arrives, potentially overwriting cloud data from another device.
 */
let isCloudSyncReady = false;

/** Enable cloud sync only after fikr.one verifies both identity and plan. */
async function setCurrentUser(uid, idToken) {
  const prev = currentUserId;
  currentIdToken = idToken ?? null;
  currentUserId = null;
  currentAccountProfile = null;

  if (currentIdToken) {
    try {
      const profile = await dc.getCurrentUser(currentIdToken);
      currentAccountProfile = profile;
      if (profile.canSync && (profile.plan === 'plus' || profile.plan === 'pro')) {
        currentUserId = profile.uid;
      }
    } catch (error) {
      console.warn('[CloudSync] Token verification failed; staying local:', error.message);
    }
  }
  authStateResolved = true;

  if (prev !== currentUserId) {
    console.log(currentUserId
      ? `[CloudSync] Verified managed user: ${currentUserId}`
      : '[CloudSync] Cloud sync disabled — local mode');
  }
  scheduleRelayPoll();
  scheduleExternalRelayPoll();
  return currentAccountProfile;
}


// In dev mode (launched by electron:dev) Electron loads from the Next.js HMR
// dev server instead of the static export in out/.
const IS_DEV = process.env.ELECTRON_IS_DEV === '1';
const DEV_SERVER_URL = 'http://localhost:3741';
const secureStorageProfile = configureSafeStorageProfile(app, IS_DEV);
const UPDATE_FEED = {
  provider: "github",
  owner: "bigmints",
  repo: "fikr-studio",
  releaseType: "release"
};
let pendingAuthState = null;
let pendingAuthExpiresAt = 0;
let pendingAuthCallbackUrl = 'fikr-studio://auth/callback';
let pendingAuthServer = null;
let pendingAuthServerTimer = null;

function getRendererContentSecurityPolicy() {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = [
    "'self'",
    'https:',
    'http://127.0.0.1:*',
    'http://localhost:*',
  ];

  if (IS_DEV) {
    // Next.js React Refresh evaluates its development runtime and uses HMR sockets.
    scriptSources.push("'unsafe-eval'");
    connectSources.push('ws://127.0.0.1:*', 'ws://localhost:*');
  }

  return [
    "default-src 'self' file:",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ');
}

function applyRendererContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame' || !isTrustedRendererUrl(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const responseHeaders = { ...details.responseHeaders };
    for (const name of Object.keys(responseHeaders)) {
      if (name.toLowerCase() === 'content-security-policy') delete responseHeaders[name];
    }
    responseHeaders['Content-Security-Policy'] = [getRendererContentSecurityPolicy()];
    callback({ responseHeaders });
  });
}

function isTrustedRendererUrl(url) {
  if (IS_DEV) return url.startsWith(`${DEV_SERVER_URL}/`) || url === DEV_SERVER_URL;
  return url.startsWith('file:');
}

function openExternalHttps(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid URL'); }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS links are allowed');
  return shell.openExternal(parsed.toString());
}

function openExternalAuth(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid auth URL'); }
  const isSecure = parsed.protocol === 'https:';
  const isDevLoopback = IS_DEV
    && parsed.protocol === 'http:'
    && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (!isSecure && !isDevLoopback) throw new Error('Invalid auth URL');
  return shell.openExternal(parsed.toString());
}

function hardenWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url).catch(error => {
      console.warn('[Security] Blocked external window:', error.message);
    });
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault();
      console.warn('[Security] Blocked renderer navigation');
    }
  });
}

function handleAuthCallback(url) {
  const result = consumeAuthCallback(
    url,
    pendingAuthState,
    pendingAuthExpiresAt,
    Date.now(),
    pendingAuthCallbackUrl,
  );
  if (!result.accepted) {
    console.warn('[Auth] Rejected invalid or expired deep-link callback');
    return false;
  }
  pendingAuthState = null;
  pendingAuthExpiresAt = 0;
  closePendingAuthServer();
  if (mainWindow) pushToRenderer(mainWindow, 'auth-token', { token: result.token });
  return true;
}

function closePendingAuthServer() {
  if (pendingAuthServerTimer) clearTimeout(pendingAuthServerTimer);
  pendingAuthServerTimer = null;
  if (pendingAuthServer) pendingAuthServer.close();
  pendingAuthServer = null;
}

function startDevelopmentAuthCallback() {
  closePendingAuthServer();
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      const callbackUrl = port
        ? new URL(request.url || '/', `http://127.0.0.1:${port}`).toString()
        : '';
      const accepted = request.method === 'GET' && handleAuthCallback(callbackUrl);
      response.writeHead(accepted ? 200 : 400, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(accepted
        ? '<!doctype html><meta charset="utf-8"><script>history.replaceState(null,"","/auth/complete")</script><p>Sign-in complete. You can return to Fikr Studio.</p>'
        : '<!doctype html><meta charset="utf-8"><p>This sign-in callback is invalid or expired.</p>');
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        server.close();
        reject(new Error('Unable to start the development auth callback'));
        return;
      }
      pendingAuthServer = server;
      pendingAuthServerTimer = setTimeout(() => {
        closePendingAuthServer();
        pendingAuthState = null;
        pendingAuthExpiresAt = 0;
      }, 10 * 60 * 1000);
      resolve(`http://127.0.0.1:${address.port}/auth/callback`);
    });
  });
}


// Only an installed app may claim the system-wide SSO callback. A development
// Electron process uses the generic Electron executable and would otherwise
// steal fikr-studio:// from the installed product, opening a blank dev window.
if (app.isPackaged) {
  app.setAsDefaultProtocolClient("fikr-studio");
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle URL from second instance (e.g. Windows/Linux or macOS dev mode)
    const url = commandLine.find(arg => arg.startsWith("fikr-studio://"));
    if (url) handleAuthCallback(url);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
let MCP_PORT = 3025;
const WORKSPACE_DIR = path.join(app.getPath("home"), ".fikr-studio");
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.json");
const WORKSPACE_BACKUP_FILE = path.join(WORKSPACE_DIR, "workspace.backup.json");
const INTRO_FILE = path.join(WORKSPACE_DIR, "intro-seen");
const SECURE_AI_KEYS_FILE = secureStorageProfile.secureAiKeysFile;
const MCP_AUTH_FILE = path.join(secureStorageProfile.userDataPath, 'mcp-auth.json');
let mcpAuthToken = null;
const workspaceStore = createWorkspaceStore({
  fs,
  directory: WORKSPACE_DIR,
  primaryFile: WORKSPACE_FILE,
  backupFile: WORKSPACE_BACKUP_FILE,
});

// ─── Node / npx resolver ──────────────────────────────────────────────────────
/**
 * Find a `npx` binary backed by Node.js >= 20.
 * Claude Desktop (and other MCP clients) inherit the system PATH which may
 * resolve to an old Homebrew/nvm Node (e.g. v14). Using that npx to run
 * `fikr-studio-mcp@latest` fails because npm v11 requires Node >=20.
 *
 * Strategy:
 *  1. Walk known nvm version directories for Node >=20, pick the highest.
 *  2. Fall back to the PATH `npx` if nothing better is found.
 */
function findCompatibleNpx() {
  const home = os.homedir();
  const nvmVersionsDir = path.join(home, ".nvm", "versions", "node");

  try {
    if (fs.existsSync(nvmVersionsDir)) {
      const versions = fs.readdirSync(nvmVersionsDir)
        .filter(v => /^v(\d+)/.test(v))
        .filter(v => parseInt(v.slice(1), 10) >= 20)
        .sort((a, b) => {
          const pa = a.slice(1).split(".").map(Number);
          const pb = b.slice(1).split(".").map(Number);
          for (let i = 0; i < 3; i++) if ((pa[i]||0) !== (pb[i]||0)) return (pb[i]||0) - (pa[i]||0);
          return 0;
        });

      for (const ver of versions) {
        const npxPath = path.join(nvmVersionsDir, ver, "bin", "npx");
        if (fs.existsSync(npxPath)) {
          console.log(`[Fikr Studio] findCompatibleNpx → ${npxPath} (${ver})`);
          return npxPath;
        }
      }
    }
  } catch (e) {
    console.warn("[Fikr Studio] findCompatibleNpx: nvm scan failed:", e.message);
  }

  // Fallback: PATH npx (may be old — warn but don't block)
  try {
    const { execSync } = require("child_process");
    const found = execSync("which npx", { env: { ...process.env, PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin" } })
      .toString().trim();
    if (found) return found;
  } catch {}

  return "npx";
}


/** Resolves once the deterministic local relevance engine is ready. */
const pipelineReady = Promise.resolve(true);

function loadEmbeddingModel() {
  return pipelineReady;
}

/** Generate a deterministic 384-dim local relevance vector. */
async function embedText(text) {
  await pipelineReady;
  return Array.from(embedRelevanceVector(text));
}

/** Cosine similarity between two equal-length float arrays */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Background embedding queue.
 * Re-indexes any note in the workspace that is missing a relevance vector.
 * Debounced — runs at most once every 30 s regardless of how many saves fire.
 */
let embedQueueRunning = false;
let embedQueueTimer = null;

function scheduleEmbedQueue() {
  // If already scheduled or running, do nothing — it will pick up the latest disk state
  if (embedQueueTimer || embedQueueRunning) return;

  // Quick pre-check: does anything actually need embedding?
  const ws = loadProjectsFromDisk();
  if (!ws) return;
  const projects = Array.isArray(ws) ? ws : (ws.projects || []);
  const needsEmbedding = projects.some(p =>
    (p.blocks || []).some(b => !b.embedding && b.text)
  );
  if (!needsEmbedding) return;  // nothing to do — skip silently

  embedQueueTimer = setTimeout(() => {
    embedQueueTimer = null;
    runEmbedQueue().catch(console.error);
  }, 30_000);  // 30-second cooldown
}

async function runEmbedQueue() {
  if (embedQueueRunning) return;
  embedQueueRunning = true;
  try {
    const workspace = loadProjectsFromDisk();
    if (!workspace) return;
    const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
    let dirty = false;

    for (const proj of projects) {
      for (const block of proj.blocks || []) {
        if (!block.embedding && block.text) {
          const embedding = await embedText(block.text);
          if (embedding) {
            block.embedding = embedding;
            dirty = true;
          }
        }
      }
    }

    if (dirty) {
      saveProjectsToDisk(Array.isArray(workspace) ? projects : { ...workspace, projects });
      console.log("[Fikr Studio] Embedding queue flushed — workspace updated");
    }
  } finally {
    embedQueueRunning = false;
  }
}

/**
 * Fire-and-forget: ask fikr.one to generate and store 768-dim embeddings
 * for any notes in this workspace that are missing a server-side embedding.
 * Only runs for Plus/Pro users with a valid ID token.
 */
async function triggerServerEmbed(workspace) {
  if (!currentUserId || !currentIdToken) return;
  try {
    const projects = Array.isArray(workspace) ? workspace : (workspace?.projects || []);
    const noteIds = projects
      .flatMap(p => p.blocks || [])
      .filter(b => b.id && b.text)
      .map(b => b.id);

    if (!noteIds.length) return;

    const res = await fetch('https://fikr.one/api/studio/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentIdToken}`,
      },
      body: JSON.stringify({ noteIds }),
    });

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn('[Fikr Studio] Server embed request failed:', res.status);
      }
      return;
    }

    const result = await res.json();
    console.log(`[Fikr Studio] Server embed: embedded=${result.embedded} skipped=${result.skipped}`);
  } catch (e) {
    // Non-critical — local embeddings still work
    console.warn('[Fikr Studio] Server embed error (non-fatal):', e.message);
  }
}


function ensureWorkspaceDir() {
  workspaceStore.ensureDirectory();
}

function loadProjectsFromDisk() {
  return workspaceStore.load();
}

function saveProjectsToDisk(data) {
  return workspaceStore.save(data);
}

async function loadCloudWorkspaceWithFirstSyncSeed() {
  const state = await dc.loadWorkspaceState(currentIdToken);
  const selected = selectFirstSyncWorkspace({
    cloudWorkspace: state.workspace,
    initialized: state.initialized,
    localWorkspace: loadProjectsFromDisk(),
  });
  if (selected.shouldSeed) {
    await dc.saveWorkspace(currentIdToken, selected.workspace, new Set(), new Set(), new Set());
  }
  return selected.workspace;
}

const ALLOWED_AI_PROVIDERS = new Set(['openrouter', 'openai', 'gemini']);

function readSecureAiKeys() {
  if (!fs.existsSync(SECURE_AI_KEYS_FILE)) return {};
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is unavailable');
  const encrypted = Buffer.from(fs.readFileSync(SECURE_AI_KEYS_FILE, 'utf8'), 'base64');
  return JSON.parse(safeStorage.decryptString(encrypted));
}

function writeSecureAiKeys(keys) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is unavailable');
  const encrypted = safeStorage.encryptString(JSON.stringify(keys));
  fs.mkdirSync(path.dirname(SECURE_AI_KEYS_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(SECURE_AI_KEYS_FILE, encrypted.toString('base64'), { mode: 0o600 });
  fs.chmodSync(SECURE_AI_KEYS_FILE, 0o600);
}

function assertAiProvider(provider) {
  if (!ALLOWED_AI_PROVIDERS.has(provider)) throw new Error('Unsupported AI provider');
}

function loadOrCreateMcpAuthToken() {
  return loadOrCreateLocalMcpAuthToken({ fs, filePath: MCP_AUTH_FILE, randomBytes });
}

function isAuthorizedMcpRequest(req, url) {
  return authorizeMcpRequest(req, url, mcpAuthToken);
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const lastSyncedNoteIds = new Set();
const lastSyncedProjectIds = new Set();
const lastSyncedGenProjectIds = new Set();

function updateLastSyncedIds(workspace) {
  lastSyncedNoteIds.clear();
  lastSyncedProjectIds.clear();
  lastSyncedGenProjectIds.clear();
  if (!workspace) return;
  const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
  for (const proj of projects) {
    if (proj.id) lastSyncedProjectIds.add(proj.id);
    if (proj.blocks) {
      for (const b of proj.blocks) if (b.id) lastSyncedNoteIds.add(b.id);
    }
    if (proj.ghostNotes) {
      for (const g of proj.ghostNotes) if (g.id) lastSyncedNoteIds.add(g.id);
    }
  }
  if (!Array.isArray(workspace) && workspace.studioProjects) {
    for (const p of workspace.studioProjects) if (p.id) lastSyncedGenProjectIds.add(p.id);
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function assertTrustedIpc(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Blocked IPC from an untrusted renderer');
  }
}

function assertWorkspacePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid workspace payload');
  }
  const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (bytes > 32 * 1024 * 1024) throw new Error('Workspace payload exceeds 32 MB');
}

/**
 * Load projects through the authenticated Studio API, else fall back to local disk.
 * Always also write through to local disk as offline cache.
 */
ipcMain.handle("fikr-studio:load-projects", async (event) => {
  assertTrustedIpc(event);
  // Plus/Pro: load through fikr.one, fall back to local disk cache on failure.
  if (currentUserId) {
    try {
      const workspace = await loadCloudWorkspaceWithFirstSyncSeed();
      if (workspace) {
        updateLastSyncedIds(workspace);
        saveProjectsToDisk(workspace); // keep local cache warm
        return workspace;
      }
    } catch (err) {
      console.error('[CloudSync] load-projects failed, using local cache:', err.message);
    }
  }
  // Free / offline
  const data = loadProjectsFromDisk();
  updateLastSyncedIds(data);
  return data;
});

/**
 * Save projects through fikr.one if eligible, always to local disk.
 */
ipcMain.handle("fikr-studio:save-projects", async (_event, data) => {
  assertTrustedIpc(_event);
  assertWorkspacePayload(data);
  const ok = saveProjectsToDisk(data);  // always write local cache
  scheduleEmbedQueue();  // debounced — at most once per 30s
  // Plus/Pro: background sync through the authenticated API after cloud load.
  // If we haven't loaded from cloud yet, we don't know what the authoritative state
  // is — saving now risks overwriting another device's data with our stale disk cache.
  if (currentUserId && isCloudSyncReady) {
    dc.saveWorkspace(currentIdToken, data, lastSyncedNoteIds, lastSyncedProjectIds, lastSyncedGenProjectIds)
      .then(() => {
        updateLastSyncedIds(data);
        triggerServerEmbed(data);
      })
      .catch((err) => {
        console.error('[CloudSync] save-projects sync failed:', err.message);
      });
  } else if (currentUserId && !isCloudSyncReady) {
    console.log('[CloudSync] save-projects: cloud write blocked until initial sync completes');
  }
  return ok;
});
ipcMain.handle("fikr-studio:get-mcp-port", async (event) => {
  assertTrustedIpc(event);
  return mcpServerReadyPromise;
});
ipcMain.handle('fikr-studio:get-mcp-connection', async (event) => {
  assertTrustedIpc(event);
  const port = await mcpServerReadyPromise;
  return { port, token: mcpAuthToken };
});
ipcMain.handle('fikr-studio:get-account', async (event) => {
  assertTrustedIpc(event);
  if (!currentIdToken || !currentAccountProfile) return null;
  let relayApiKey = '';
  if (currentUserId) {
    try {
      relayApiKey = (await dc.getRelayKey(currentIdToken)).relayApiKey || '';
    } catch (error) {
      if (error.status !== 403) console.warn('[CloudRelay] Failed to load relay key:', error.message);
    }
  }
  return { ...currentAccountProfile, relayApiKey };
});
ipcMain.handle("fikr-studio:open-auth", async (event) => {
  assertTrustedIpc(event);
  pendingAuthState = randomBytes(32).toString('hex');
  pendingAuthExpiresAt = Date.now() + 10 * 60 * 1000;
  pendingAuthCallbackUrl = IS_DEV
    ? await startDevelopmentAuthCallback()
    : 'fikr-studio://auth/callback';
  const callback = new URL(pendingAuthCallbackUrl);
  callback.searchParams.set('state', pendingAuthState);
  const authBaseUrl = IS_DEV
    ? process.env.FIKR_AUTH_BASE_URL || 'http://localhost:3000'
    : 'https://www.fikr.one';
  const login = new URL('/login', authBaseUrl);
  login.searchParams.set('returnUrl', callback.toString());
  return openExternalAuth(login.toString());
});

/**
 * Called by the renderer whenever Firebase Auth state changes.
 * uid = null means the user signed out.
 * On sign-in: loads through fikr.one and pushes to renderer (fixes race
 * condition where loadProjects fires before auth resolves).
 */
ipcMain.handle("fikr-studio:set-user", async (_event, payload) => {
  assertTrustedIpc(_event);
  const { uid, idToken } = payload ?? {};
  if (uid !== null && typeof uid !== 'string') throw new Error('Invalid user id');
  if (idToken !== null && (typeof idToken !== 'string' || idToken.length > 16_384)) {
    throw new Error('Invalid ID token');
  }
  const wasSignedIn = !!currentUserId;
  const profile = await setCurrentUser(uid ?? null, idToken ?? null);

  if (!currentUserId) {
    // User signed out — reset the gate so if they sign back in we re-load from cloud
    // before allowing any cloud saves.
    isCloudSyncReady = false;
    return profile;
  }

  // Only trigger a post-auth cloud load if startup is already complete.
  // During startup, runStartupSequence() handles the sync itself.
  if (currentUserId && !wasSignedIn && mainWindow && isStartupComplete) {
    try {
      const cloudWorkspace = await loadCloudWorkspaceWithFirstSyncSeed();
      if (cloudWorkspace && Array.isArray(cloudWorkspace.projects)) {
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        pushToRenderer(mainWindow, "workspace-synced", cloudWorkspace);
        console.log('[CloudSync] Post-auth workspace pushed to renderer');
        // Trigger server-side embedding for any notes not yet embedded
        triggerServerEmbed(cloudWorkspace).catch(e =>
          console.warn('[Fikr Studio] Post-auth embed failed:', e.message)
        );
      }
    } catch (err) {
      console.error('[CloudSync] Post-auth load failed:', err.message);
    } finally {
      // Allow saves now that we have the authoritative cloud state
      isCloudSyncReady = true;
      console.log('[CloudSync] Initial cloud load completed');
    }
  }
  return profile;
});


ipcMain.handle("fikr-studio:sync-workspace", async (event) => {
  assertTrustedIpc(event);
  if (currentUserId) {
    try {
      const cloudWorkspace = await loadCloudWorkspaceWithFirstSyncSeed();
      if (cloudWorkspace && Array.isArray(cloudWorkspace.projects)) {
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        if (mainWindow) {
          pushToRenderer(mainWindow, "workspace-synced", cloudWorkspace);
        }
        return { success: true };
      }
      return { success: false, error: 'No projects found in cloud' };
    } catch (err) {
      console.error('[CloudSync] Manual sync failed:', err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Not signed in' };
});

/**
 * Proper logout flow:
 * 1. If the user is signed in (Plus/Pro), attempt a final API sync.
 * 2. Show a native dialog: "Keep local data" vs "Clear everything".
 * 3. If the user picks "Clear", delete workspace.json and clear studio localStorage key.
 * 4. Tell the renderer to reset its state, then the renderer calls Firebase signOut.
 *
 * Returns { cleared: boolean } so the renderer knows what to do next.
 */
ipcMain.handle("fikr-studio:logout", async (_event, payload) => {
  assertTrustedIpc(_event);
  const { currentData } = payload ?? {};
  if (currentData) assertWorkspacePayload(currentData);
  let finalSyncFailed = Boolean(currentUserId && !currentData);
  // ── Step 1: Final cloud sync (best-effort, don't block logout) ────────────
  if (currentUserId && currentData) {
    try {
      await dc.saveWorkspace(
        currentIdToken,
        currentData,
        lastSyncedNoteIds,
        lastSyncedProjectIds,
        lastSyncedGenProjectIds,
      );
      console.log('[Logout] Final cloud sync completed for', currentUserId);
    } catch (err) {
      finalSyncFailed = true;
      console.warn('[Logout] Final sync failed (continuing):', err.message);
    }
  }

  // ── Step 2: Show native keep/clear dialog ─────────────────────────────────
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Signing out',
    message: 'What should happen to your local data?',
    detail: 'This choice affects only the local workspace cache. It does not delete cloud data.',
    buttons: ['Keep local workspace', 'Clear local workspace', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    icon: undefined,
  });

  // response 2 = Cancel — abort logout
  if (response === 2) {
    return { cleared: false, cancelled: true };
  }

  let clearLocal = response === 1;

  if (clearLocal && finalSyncFailed) {
    const warning = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Cloud sync did not finish',
      message: 'Keep the local workspace to avoid losing unsynced changes.',
      detail: 'Fikr Studio could not confirm the final cloud save. Clearing now may permanently remove changes that exist only on this Mac.',
      buttons: ['Keep local workspace', 'Clear anyway'],
      defaultId: 0,
      cancelId: 0,
    });
    clearLocal = warning.response === 1;
  }

  // ── Step 3: Optionally wipe local cache ───────────────────────────────────
  if (clearLocal) {
    const removal = clearLocalFiles(fs, [WORKSPACE_FILE, WORKSPACE_BACKUP_FILE]);
    if (!removal.cleared) {
      clearLocal = false;
      console.warn('[Logout] Local workspace could not be fully cleared');
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Local workspace was not cleared',
        message: 'Fikr Studio could not remove every local workspace file.',
        detail: 'Your data has not been reported as cleared. Check file permissions and try again.',
        buttons: ['OK'],
      });
    }
  }

  // ── Step 4: Clear the in-memory user so future saves don't cloud-sync ─────
  await setCurrentUser(null, null);

  // Push reset event so renderer re-initialises with empty / fresh state
  if (clearLocal && mainWindow) {
    pushToRenderer(mainWindow, 'workspace-cleared', {});
  }

  return { cleared: clearLocal, cancelled: false };
});

ipcMain.handle("fikr-studio:open-url", async (_event, url) => {
  assertTrustedIpc(_event);
  if (typeof url !== 'string' || url.length > 4096) throw new Error('Invalid URL');
  return openExternalHttps(url);
});
ipcMain.handle("fikr-studio:execute-tool", async (event, payload) => {
  assertTrustedIpc(event);
  const { name, args } = payload ?? {};
  validateToolCall(name, args);
  return await executeTool(name, args, mainWindow);
});
ipcMain.handle("fikr-studio:get-intro-seen", (event) => {
  assertTrustedIpc(event);
  return fs.existsSync(INTRO_FILE);
});
ipcMain.handle("fikr-studio:set-intro-seen", (event) => {
  assertTrustedIpc(event);
  ensureWorkspaceDir();
  fs.writeFileSync(INTRO_FILE, "1");
  return true;
});

ipcMain.handle('fikr-studio:secure-has-ai-key', (event, provider) => {
  assertTrustedIpc(event);
  assertAiProvider(provider);
  return Boolean(readSecureAiKeys()[provider]);
});

ipcMain.handle('fikr-studio:secure-set-ai-key', (event, provider, apiKey) => {
  assertTrustedIpc(event);
  assertAiProvider(provider);
  if (typeof apiKey !== 'string' || apiKey.length > 16_384) throw new Error('Invalid API key');
  const keys = readSecureAiKeys();
  if (apiKey) keys[provider] = apiKey;
  else delete keys[provider];
  writeSecureAiKeys(keys);
  return true;
});

ipcMain.handle('fikr-studio:request-ai', async (event, payload) => {
  assertTrustedIpc(event);
  const { provider, body } = payload ?? {};
  assertAiProvider(provider);
  const apiKey = readSecureAiKeys()[provider] ?? '';
  return performAiRequest({ provider, body, apiKey });
});

  function getMcpConfigPath(client) {
    const home = os.homedir();
    if (client === "claude") {
      return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    } else if (client === "windsurf") {
      return path.join(home, ".codeium", "windsurf", "mcp_config.json");
    }
    return null;
  }

  ipcMain.handle("fikr-studio:check-mcp", async (_event, client) => {
    assertTrustedIpc(_event);
    const configPath = getMcpConfigPath(client);
    if (!configPath || !fs.existsSync(configPath)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return !!(data?.mcpServers?.["fikr-studio"]);
    } catch {
      return false;
    }
  });

  ipcMain.handle("fikr-studio:install-mcp", async (_event, client) => {
    assertTrustedIpc(_event);
    const configPath = getMcpConfigPath(client);
    if (!configPath) throw new Error("Unknown client");

    updateJsonConfig({ fs, filePath: configPath, mutate(config) {
      if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
        config.mcpServers = {};
      }
      if (client === "claude") {
        config.mcpServers["fikr-studio"] = {
          url: `http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}`,
          type: "sse"
        };
      } else if (client === "windsurf") {
        config.mcpServers["fikr-studio"] = {
          serverUrl: `http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}`
        };
      }
      return config;
    } });
    return true;
  });

  ipcMain.handle("fikr-studio:uninstall-mcp", async (_event, client) => {
    assertTrustedIpc(_event);
    const configPath = getMcpConfigPath(client);
    if (!configPath || !fs.existsSync(configPath)) return false;

    try {
      updateJsonConfig({ fs, filePath: configPath, mutate(config) {
        if (config.mcpServers && typeof config.mcpServers === 'object') {
          delete config.mcpServers["fikr-studio"];
        }
        return config;
      } });
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fikr-studio:test-mcp", async (_event, client) => {
    assertTrustedIpc(_event);
    // First check config is installed
    const configPath = getMcpConfigPath(client);
    const configInstalled = configPath && fs.existsSync(configPath) && (() => {
      try {
        const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
        return !!(data?.mcpServers?.["fikr-studio"]);
      } catch { return false; }
    })();
    if (!configInstalled) return { ok: false, error: "Not configured" };

    // Then ping the local SSE server
    return new Promise((resolve) => {
      const req = http.request(
        { hostname: "localhost", port: MCP_PORT, path: "/sse", method: "GET",
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${mcpAuthToken}` }, timeout: 3000 },
        (res) => {
          res.destroy(); // we only need headers
          resolve({ ok: res.statusCode === 200, status: res.statusCode });
        }
      );
      req.on("error", (e) => resolve({ ok: false, error: e.message }));
      req.on("timeout",   () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
      req.end();
    });
  });

  ipcMain.handle("fikr-studio:get-usage", async (_event) => {
    assertTrustedIpc(_event);
    if (!currentIdToken) return null;
    try {
      const fetchModule = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      // Using global fetch if available (Node 18+), fallback to node-fetch if we imported it in another way or it's not available
      const doFetch = typeof fetch !== 'undefined' ? fetch : fetchModule;
      
      const res = await doFetch("https://fikr.one/api/user/usage", {
        headers: { Authorization: `Bearer ${currentIdToken}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("[Fikr Studio] Failed to fetch usage:", e.message);
      return null;
    }
  });

// ─── MCP Server ───────────────────────────────────────────────────────────────
/** Active SSE clients mapped by sessionId */
const sseSessions = new Map();

/** The tool definitions advertised to MCP clients */
const MCP_TOOLS = [
  {
    name: "create_note",
    description: "Add a new note to the active Fikr Studio canvas. Configured AI may classify and enrich it afterward.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The raw text content of the note" },
        project_id: { type: "string", description: "Target project ID. Omit to use the first project." },
        idempotency_key: { type: "string", description: "Optional stable delivery ID used to prevent duplicate notes." },
      },
      required: ["text"],
    },
  },
  {
    name: "search_notes",
    description: "Search notes across a Fikr Studio project using keyword matching",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        project_id: { type: "string", description: "Project ID to search. Omit for all projects." },
        limit: { type: "number", description: "Max results to return (default: 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_canvas",
    description: "Get all notes from a Fikr Studio project/canvas",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID. Omit for the first/active project." },
      },
    },
  },
  {
    name: "list_projects",
    description: "List all Fikr Studio projects/spaces with their IDs and names",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_project",
    description: "Create a new Fikr Studio project/space",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the new project" },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_note",
    description: "Remove a note from Fikr Studio by its ID",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note ID to delete" },
        project_id: { type: "string", description: "Project ID containing the note" },
      },
      required: ["note_id"],
    },
  },
  {
    name: "update_note",
    description: "Edit an existing note in Fikr Studio (text, category, type, annotation)",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note ID to update" },
        new_text: { type: "string", description: "Replacement text" },
        project_id: { type: "string", description: "Project ID containing the note" },
        type: { type: "string", description: "Optional new type" },
        category: { type: "string", description: "Optional new category" },
        annotation: { type: "string", description: "Optional new annotation" },
      },
      required: ["note_id", "new_text"],
    },
  },
  {
    name: "get_synthesis",
    description: "Get the AI-generated synthesis notes (emergent insights) from a canvas",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID. Omit for the first project." },
      },
    },
  },
  {
    name: "create_note_synthesized",
    description: "Add a pre-synthesized note to Fikr Studio. Use this when you have already enriched the note using the fikr-studio-skill pre-synthesis step. Fikr Studio will index and store it immediately without running its own AI enrichment pass. The note will appear on the canvas instantly as fully annotated.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Original raw note text" },
        project_id: { type: "string", description: "Target project ID. Omit to use the first project." },
        contentType: {
          type: "string",
          enum: ["claim","question","task","idea","entity","quote","reference","definition","opinion","reflection","narrative","comparison","general"],
          description: "AI-classified content type from pre-synthesis"
        },
        category: { type: "string", description: "Short domain label from pre-synthesis (e.g. 'Product Strategy')" },
        annotation: { type: "string", description: "2-4 sentence AI-generated annotation from pre-synthesis" },
        confidence: { type: "number", description: "Classification confidence 0-100 from pre-synthesis" },
        idempotency_key: { type: "string", description: "Optional stable delivery ID used to prevent duplicate notes." },
      },
      required: ["text", "contentType", "category", "annotation"],
    },
  },
];

/** Push an event to the React renderer so the canvas updates live */
function pushToRenderer(mainWindow, type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("fikr-studio:external-event", { type, payload });
  }
}

/** Execute an MCP tool call and return the result */
async function executeTool(name, args, mainWindow) {
  validateToolCall(name, args);
  const workspace = loadProjectsFromDisk() || { projects: [], activeProjectId: "" };
  // Support both the new { projects, activeProjectId } shape and a legacy raw array
  const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
  const save = () => {
    const data = Array.isArray(workspace) ? projects : { ...workspace, projects };
    saveProjectsToDisk(data);  // always write local cache
    scheduleEmbedQueue();  // debounced
    // Plus/Pro: background sync through the authenticated Studio API.
    if (currentUserId) {
      dc.saveWorkspace(
        currentIdToken,
        data,
        lastSyncedNoteIds,
        lastSyncedProjectIds,
        lastSyncedGenProjectIds,
      ).then(() => updateLastSyncedIds(data)).catch((err) => {
        console.error('[CloudSync] MCP sync failed:', err.message);
      });
    }
  };
  const getProject = (id) =>
    id ? projects.find((p) => p.id === id) : projects[0];

  switch (name) {
    case "list_projects": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              projects.map((p) => ({ id: p.id, name: p.name, noteCount: (p.blocks || []).length })),
              null, 2
            ),
          },
        ],
      };
    }

    case "get_canvas": {
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const notes = (proj.blocks || []).map((b) => ({
        id: b.id,
        text: b.text,
        type: b.contentType,
        category: b.category,
        annotation: b.annotation,
        timestamp: b.timestamp,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ project: proj.name, notes }, null, 2) }],
      };
    }

    case "search_notes": {
      const query    = args.query || "";
      const limit    = Math.min(args.limit || 10, 50);
      const searchIn = args.project_id ? [getProject(args.project_id)].filter(Boolean) : projects;

      // ── Tier 1: deterministic local relevance search (384 dimensions) ────
      // Fully offline and dependency-free; no server call or model download.
      const queryEmbedding = await embedText(query);
      if (queryEmbedding) {
        const scored = [];
        for (const proj of searchIn) {
          for (const b of proj.blocks || []) {
            if (!b.text) continue;
            const sim = b.embedding ? cosineSimilarity(queryEmbedding, b.embedding) : 0;
            scored.push({
              score: sim,
              project: proj.name,
              project_id: proj.id,
              id: b.id,
              text: b.text,
              type: b.contentType,
              annotation: b.annotation,
            });
          }
        }
        const results = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .filter(r => r.score > 0.2)
          .map(({ score, ...rest }) => ({ ...rest, similarity: Math.round(score * 100) / 100 }));

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      // Keyword fallback when no stored relevance vector is available.
      const q = query.toLowerCase();
      const kwResults = [];
      for (const proj of searchIn) {
        for (const b of proj.blocks || []) {
          const haystack = `${b.text} ${b.annotation || ""} ${b.category || ""}`.toLowerCase();
          if (haystack.includes(q)) {
            kwResults.push({ project: proj.name, project_id: proj.id, id: b.id, text: b.text, type: b.contentType, annotation: b.annotation });
            if (kwResults.length >= limit) break;
          }
        }
        if (kwResults.length >= limit) break;
      }
      return { content: [{ type: "text", text: JSON.stringify(kwResults, null, 2) }] };
    }

    case "create_note": {
      if (args.idempotency_key) {
        const existing = projects
          .flatMap((project) => project.blocks || [])
          .find((note) => note.externalRelayMessageId === args.idempotency_key);
        if (existing) {
          return { content: [{ type: "text", text: `Note already created with id: ${existing.id}` }] };
        }
      }
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const newNote = {
        id: generateId(),
        text: args.text,
        timestamp: Date.now(),
        contentType: "general",
        isEnriching: true, // Let the frontend auto-enrich
        fromMcp: true,
        ...(args.idempotency_key ? { externalRelayMessageId: args.idempotency_key } : {}),
      };
      // Generate embedding synchronously before saving (MCP caller already waits)
      const embedding = await embedText(args.text);
      if (embedding) newNote.embedding = embedding;
      proj.blocks = [...(proj.blocks || []), newNote];
      save();
      // Push live event to React canvas
      pushToRenderer(mainWindow, "note-added", { projectId: proj.id, note: newNote });
      return {
        content: [{ type: "text", text: `Note created with id: ${newNote.id} in project "${proj.name}"` }],
      };
    }

    case "create_project": {
      const newProject = {
        id: generateId(),
        name: args.name,
        blocks: [],
        collapsedIds: [],
        ghostNotes: [],
      };
      projects.push(newProject);
      save();
      pushToRenderer(mainWindow, "project-created", { project: newProject });
      return {
        content: [{ type: "text", text: `Project "${args.name}" created with id: ${newProject.id}` }],
      };
    }

    case "delete_note": {
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const before = (proj.blocks || []).length;
      proj.blocks = (proj.blocks || []).filter((b) => b.id !== args.note_id);
      if (proj.blocks.length === before) {
        return { content: [{ type: "text", text: `Note ${args.note_id} not found` }], isError: true };
      }
      save();
      pushToRenderer(mainWindow, "note-deleted", { projectId: proj.id, noteId: args.note_id });
      return { content: [{ type: "text", text: `Note ${args.note_id} deleted` }] };
    }

    case "update_note": {
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const note = (proj.blocks || []).find((b) => b.id === args.note_id);
      if (!note) return { content: [{ type: "text", text: `Note ${args.note_id} not found` }], isError: true };
      note.text = args.new_text;
      if (args.type) note.contentType = args.type;
      if (args.category) note.category = args.category;
      if (args.annotation) note.annotation = args.annotation;
      note.isEnriching = false;
      // Re-embed on edit
      const updatedEmbedding = await embedText(args.new_text);
      if (updatedEmbedding) note.embedding = updatedEmbedding;
      save();
      pushToRenderer(mainWindow, "note-updated", { projectId: proj.id, note });
      return { content: [{ type: "text", text: `Note ${args.note_id} updated` }] };
    }

    case "get_synthesis": {
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const ghosts = (proj.ghostNotes || []).filter((n) => !n.isGenerating);
      return {
        content: [{ type: "text", text: JSON.stringify({ project: proj.name, synthesis: ghosts }, null, 2) }],
      };
    }

    case "create_note_synthesized": {
      if (args.idempotency_key) {
        const existing = projects
          .flatMap((project) => project.blocks || [])
          .find((note) => note.externalRelayMessageId === args.idempotency_key);
        if (existing) {
          return { content: [{ type: "text", text: `Pre-synthesized note already stored with id: ${existing.id}` }] };
        }
      }
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };

      // Validate required synthesis fields
      if (!args.text || !args.contentType || !args.category || !args.annotation) {
        return { content: [{ type: "text", text: "Missing required fields: text, contentType, category, annotation" }], isError: true };
      }

      const newNote = {
        id: generateId(),
        text: args.text,
        timestamp: Date.now(),
        contentType: args.contentType,
        category: args.category,
        annotation: args.annotation,
        confidence: args.confidence ?? null,
        isEnriching: false,   // already synthesized — skip UI enrichment pass
        isError: false,
        fromMcp: true,
        fromSkill: true,      // tracing flag for the canvas
        ...(args.idempotency_key ? { externalRelayMessageId: args.idempotency_key } : {}),
      };

      // Embed the combined text+annotation for richer semantic search
      // This mirrors VectorIndex.buildIndexText() which joins text | annotation
      const textToEmbed = `${args.text} | ${args.annotation}`;
      const embedding = await embedText(textToEmbed);
      if (embedding) newNote.embedding = embedding;

      proj.blocks = [...(proj.blocks || []), newNote];
      save();
      pushToRenderer(mainWindow, "note-added", { projectId: proj.id, note: newNote });

      return {
        content: [{
          type: "text",
          text: `Pre-synthesized note stored with id: ${newNote.id} in project "${proj.name}". Type: ${newNote.contentType}, Category: "${newNote.category}". Relevance vector: ${embedding ? `generated (${embedding.length} dims)` : "scheduled for the next save"}.`
        }],
      };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

// ─── Direct MCP Execution via IPC ─────────────────────────────────────────────
async function executeMcpRpc(rpc) {
  validateMcpRpc(rpc);
  switch (rpc.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "fikr-studio", version: "1.0.0" },
      };

    case "prompts/list":
      return {
        prompts: [
          {
            name: "pre_synthesis",
            description: "Instructions for performing local AI note synthesis and classification before storing in Fikr Studio",
            arguments: [
              { name: "text", description: "The raw text of the note to synthesize", required: true }
            ]
          }
        ]
      };

    case "prompts/get": {
      if (rpc.params?.name === "pre_synthesis") {
        return {
          description: "Instructions for Fikr Studio Note Synthesis",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are an expert Fikr Studio synthesis AI. Your task is to analyze the following raw note and enrich it before storing it.
                
Raw Note:
"${rpc.params?.arguments?.text || ""}"

Instructions:
1. Classify the note into ONE of these content types: claim, question, task, idea, entity, quote, reference, definition, opinion, reflection, narrative, comparison, general.
2. Determine a short 'category' label (e.g. 'Product Strategy', 'Philosophy', 'Engineering').
3. Write a 2-4 sentence 'annotation' summarizing the core insight or context.
4. Estimate a 'confidence' score (0-100) for your classification.
5. Finally, call the \`create_note_synthesized\` tool with your generated fields and the original raw text.`
              }
            }
          ]
        };
      }
      throw new Error("Unknown prompt");
    }

    case "tools/list":
      return { tools: MCP_TOOLS };

    case "tools/call": {
      const { name, arguments: args } = rpc.params || {};
      return await executeTool(name, args || {}, mainWindow);
    }

    case "resources/list":
      return {
        resources: [
          { uri: "fikr-studio://projects", name: "All Projects", description: "Full workspace dump", mimeType: "application/json" },
        ],
      };

    case "resources/read": {
      if (rpc.params?.uri === "fikr-studio://projects") {
        const workspace = loadProjectsFromDisk() || { projects: [] };
        const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
        return { contents: [{ uri: "fikr-studio://projects", mimeType: "application/json", text: JSON.stringify(projects, null, 2) }] };
      } else {
        throw new Error("Unknown resource URI");
      }
    }

    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null; // Notifications have no response

    // Optional MCP methods — not implemented, acknowledge gracefully
    case "resources/subscribe":
    case "resources/unsubscribe":
      return { jsonrpc: "2.0", id: rpc.id, result: {} };

    default:
      throw new Error(`Method not found: ${rpc.method}`);
  }
}

ipcMain.handle("fikr-studio:execute-mcp", async (event, rpc) => {
  assertTrustedIpc(event);
  return executeMcpRpc(rpc);
});

let relayPollTimer = null;
let relayPollRunning = false;
let relayIdlePolls = 0;

function scheduleRelayPoll(delayMs = 2_000) {
  if (relayPollTimer) clearTimeout(relayPollTimer);
  relayPollTimer = null;
  if (!currentUserId || !currentIdToken || !isStartupComplete) return;
  relayPollTimer = setTimeout(pollCloudRelay, delayMs);
}

async function pollCloudRelay() {
  if (relayPollRunning || !currentUserId || !currentIdToken) return scheduleRelayPoll();
  relayPollRunning = true;
  let foundMessage = false;
  try {
    const message = await dc.consumeRelay(currentIdToken);
    if (message?.id && message?.leaseToken && message.payload) {
      foundMessage = true;
      try {
        const result = await executeMcpRpc(message.payload);
        await dc.acknowledgeRelay(currentIdToken, message.id, message.leaseToken, { status: 'completed', result });
      } catch (error) {
        await dc.acknowledgeRelay(currentIdToken, message.id, message.leaseToken, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  } catch (error) {
    if (error.status !== 404 && error.status !== 401 && error.status !== 403) {
      console.warn('[CloudRelay] Poll failed:', error.message);
    }
  } finally {
    relayPollRunning = false;
    relayIdlePolls = foundMessage ? 0 : Math.min(relayIdlePolls + 1, 5);
    // The remote MCP request waits at most 45 seconds. Keep the consumer well
    // below that deadline even after a long idle period.
    scheduleRelayPoll(foundMessage ? 1_000 : Math.min(10_000, 1_000 * (2 ** relayIdlePolls)));
  }
}

let externalRelayPollTimer = null;
let externalRelayPollRunning = false;
let externalRelayIdlePolls = 0;

function scheduleExternalRelayPoll(delayMs = 5_000) {
  if (externalRelayPollTimer) clearTimeout(externalRelayPollTimer);
  externalRelayPollTimer = null;
  if (!currentUserId || !currentIdToken || !isStartupComplete) return;
  externalRelayPollTimer = setTimeout(pollExternalRelay, delayMs);
}

async function pollExternalRelay() {
  if (externalRelayPollRunning || !currentUserId || !currentIdToken) {
    return scheduleExternalRelayPoll();
  }
  externalRelayPollRunning = true;
  let processed = 0;
  try {
    const response = await dc.leaseExternalMessages(currentIdToken, 5);
    const messages = Array.isArray(response?.messages) ? response.messages : [];
    for (const message of messages) {
      try {
        const result = await executeMcpRpc(externalRelayMessageToRpc(message));
        if (result?.isError) throw new Error(result.content?.[0]?.text || 'Studio rejected the external message');
        await dc.acknowledgeExternalMessage(currentIdToken, message.id, message.leaseToken, result);
        processed += 1;
      } catch (error) {
        await dc.rejectExternalMessage(
          currentIdToken,
          message.id,
          message.leaseToken,
          error instanceof Error ? error.message : 'External message processing failed',
        );
      }
    }
  } catch (error) {
    if (error.status !== 401 && error.status !== 403) {
      console.warn('[ExternalRelay] Poll failed:', error.message);
    }
  } finally {
    externalRelayPollRunning = false;
    externalRelayIdlePolls = processed > 0 ? 0 : Math.min(externalRelayIdlePolls + 1, 5);
    scheduleExternalRelayPoll(processed > 0
      ? 2_000
      : Math.min(15_000, 3_000 * (2 ** externalRelayIdlePolls)));
  }
}

/** Start the MCP HTTP/SSE server */
function startMcpServer(mainWindow) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${MCP_PORT}`);

    // ── CORS ──────────────────────────────────────────────────────────────────
    const origin = req.headers.origin;
    const allowedOrigin = origin === DEV_SERVER_URL;
    if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(allowedOrigin ? 204 : 403);
      res.end();
      return;
    }

    // ── SSE endpoint (MCP transport) ──────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/sse") {
      if (!isAuthorizedMcpRequest(req, url)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      if (sseSessions.size >= 20) {
        res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "5" });
        res.end(JSON.stringify({ error: 'Too many MCP sessions' }));
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sessionId = Math.random().toString(36).substring(2, 15);
      sseSessions.set(sessionId, res);

      // Send the MCP server info on connect
      const send = (event, data) => res.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);

      send("endpoint", `/message?sessionId=${sessionId}&token=${encodeURIComponent(mcpAuthToken)}`);

      // Keep long-lived MCP transports active. Node's EventSource/undici stack
      // otherwise closes an idle response after roughly five minutes with a
      // Body Timeout Error, leaving the next Codex tool call without a reply.
      const heartbeat = setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(": heartbeat\n\n");
      }, 15_000);
      heartbeat.unref?.();

      const closeSession = () => {
        clearInterval(heartbeat);
        sseSessions.delete(sessionId);
      };
      req.on("close", closeSession);
      res.on("close", closeSession);
      return;
    }

    // ── JSON-RPC message endpoint ─────────────────────────────────────────────
    if (req.method === "POST") {
      if (url.pathname === "/message") {
        if (!isAuthorizedMcpRequest(req, url)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        const sessionId = url.searchParams.get("sessionId");
        const sseRes = sseSessions.get(sessionId);

        if (!sseRes) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Session not found");
          return;
        }

      let body = "";
      let bodyTooLarge = false;
      req.on("data", (chunk) => {
        if (bodyTooLarge) return;
        body += chunk;
        if (Buffer.byteLength(body, 'utf8') > 1024 * 1024) bodyTooLarge = true;
      });
      req.on("end", () => {
        if (bodyTooLarge) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          return;
        }
        let rpc;
        try {
          rpc = JSON.parse(body);
          validateMcpRpc(rpc);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: 'Invalid MCP request' }));
          return;
        }

        // Standard MCP SSE: POST returns 202 Accepted, response goes via SSE
        res.writeHead(202, { "Content-Type": "text/plain" });
        res.end("Accepted");

        const respondSse = (result) => {
          sseRes.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result })}\n\n`);
        };

        const respondErrorSse = (code, message) => {
          sseRes.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code, message } })}\n\n`);
        };

        executeMcpRpc(rpc)
          .then((result) => {
            // JSON-RPC notifications are accepted but never receive a response.
            if (rpc.id !== undefined && rpc.id !== null) respondSse(result);
          })
          .catch((error) => {
            if (rpc.id !== undefined && rpc.id !== null) {
              respondErrorSse(-32603, error instanceof Error ? error.message : "Internal error");
            }
          });
      });
      return;
    }
  }

    // ── Health check ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "fikr-studio-mcp", port: MCP_PORT }));
      return;
    }

    // ── Skill files — curl http://localhost:3025/skill.md and follow instructions
    if (req.method === "GET" && (url.pathname === "/skill.md" || url.pathname.startsWith("/skills/"))) {
      if (!isAuthorizedMcpRequest(req, url)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const MASTER_SKILL = `# Fikr Studio MCP — Agent Skill

> Curl this file and follow the instructions to autonomously connect your AI agent to Fikr Studio.

## What is Fikr Studio?
Fikr Studio is a local-first knowledge canvas. This MCP server (running at http://localhost:${MCP_PORT}) lets your AI read, write, search, and synthesise notes on the active canvas.

## Step 1 — Verify the server is running
\`\`\`
curl http://localhost:${MCP_PORT}/health
\`\`\`
Expected: \`{"status":"ok"}\`
If this fails, open Fikr Studio and try again.

## Step 2 — Configure your AI client

### Claude Desktop (auto-detect)
Check if \`~/Library/Application Support/Claude/claude_desktop_config.json\` exists.
If it does, merge this config into the \`mcpServers\` key. If not, create it:
\`\`\`json
{
  "mcpServers": {
    "fikr-studio": {
      "command": "npx",
      "args": ["-y", "fikr-studio-mcp@latest", "http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}"]
    }
  }
}
\`\`\`
Then restart Claude Desktop. The 🔌 icon confirms the connection.

### Cursor
Create or edit \`~/.cursor/mcp.json\`:
\`\`\`json
{
  "mcpServers": {
    "fikr-studio": {
      "url": "http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}",
      "type": "sse"
    }
  }
}
\`\`\`

### Windsurf
Create or edit \`~/.codeium/windsurf/mcp_settings.json\`:
\`\`\`json
{
  "mcpServers": {
    "fikr-studio": {
      "serverUrl": "http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}"
    }
  }
}
\`\`\`

### Gemini CLI
Edit \`~/.gemini/settings.json\`:
\`\`\`json
{
  "mcpServers": {
    "fikr-studio": {
      "httpUrl": "http://localhost:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}"
    }
  }
}
\`\`\`

## Step 3 — Available Tools (call these via MCP)

| Tool | Description |
|------|-------------|
| \`create_note\` | Add a note to the active canvas |
| \`search_notes\` | Local relevance + keyword search across all notes |
| \`get_canvas\` | Read all notes from a project |
| \`list_projects\` | List all Fikr spaces |
| \`update_note\` | Edit an existing note |
| \`delete_note\` | Remove a note by ID |
| \`get_synthesis\` | Read AI-generated insight clusters |
| \`create_note_synthesized\` | Add a pre-enriched, classified note |

## Step 4 — Synthesis Skill
After connecting, fetch and follow the synthesis skill:
\`\`\`
curl "http://localhost:${MCP_PORT}/skills/synthesis.md?token=${encodeURIComponent(mcpAuthToken)}"
\`\`\`

## Confirm the connection
Once configured, call \`list_projects\` to confirm you can read the canvas.
Then call \`get_canvas\` on the active project and summarise what you find.
`;

      const SYNTHESIS_SKILL = `# Fikr Studio — Synthesis Skill

> Use this skill to intelligently enrich notes before saving them to the Fikr canvas.

## What is synthesis?
Instead of storing raw text, Fikr Studio can classify, annotate, and embed notes automatically.
This skill instructs you how to use the \`pre_synthesis\` MCP prompt + \`create_note_synthesized\` tool.

## When to use this skill
- After a meeting, brainstorm, or research session where you have raw notes
- When you want notes to be automatically classified and searchable by topic
- Before adding notes from external sources (Slack threads, docs, emails)

## Step-by-step

### 1. Use the pre_synthesis prompt
In your MCP client, call the \`pre_synthesis\` prompt with the raw note text.
The prompt will instruct the AI to:
1. Classify the note into one of: claim, question, task, idea, entity, quote, reference, definition, opinion, reflection, narrative, comparison, general
2. Write a 2–4 sentence annotation
3. Assign a short category label (e.g. "Product Strategy", "Engineering", "Philosophy")
4. Estimate a classification confidence (0–100)

### 2. Call create_note_synthesized
After the AI enriches the note, call the \`create_note_synthesized\` tool:
\`\`\`json
{
  "text": "<original raw text>",
  "contentType": "<classified type>",
  "category": "<category label>",
  "annotation": "<2-4 sentence annotation>",
  "confidence": 85
}
\`\`\`

### 3. Verify
Call \`get_canvas\` and confirm the note appears with its annotation and category.

## Autonomous batch synthesis
To synthesise all unannotated notes on the canvas:
1. Call \`get_canvas\` — collect all notes where \`annotation\` is empty or missing
2. For each note, run the pre_synthesis prompt
3. Call \`update_note\` with the enriched fields (or \`create_note_synthesized\` for new ones)
4. Call \`get_synthesis\` to confirm the AI insight clusters updated

## Trigger conditions
Run this skill:
- After every 5+ new notes added to the canvas
- At the start of each working session (synthesise overnight captures)
- Before generating a weekly summary
`;


      const routes = {
        "/skill.md": MASTER_SKILL,
        "/skills/synthesis.md": SYNTHESIS_SKILL,
      };

      const content = routes[url.pathname];
      if (content) {
        res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(content);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  let currentPort = 3025;

  const tryListen = (port) => {
    server.listen(port, "127.0.0.1");
  };

  server.once("listening", () => {
    MCP_PORT = currentPort;
    console.log(`[Fikr Studio] MCP server running at http://localhost:${MCP_PORT}`);

    // Resolve ready promise
    if (mcpServerReadyResolve) {
      mcpServerReadyResolve(MCP_PORT);
    }

    if (mainWindow) {
      pushToRenderer(mainWindow, "mcp-port-updated", { port: MCP_PORT });
    }

    // Write mcp-port.json lockfile
    try {
      const portData = {
        port: MCP_PORT,
        url: `http://127.0.0.1:${MCP_PORT}/sse?token=${encodeURIComponent(mcpAuthToken)}`,
        pid: process.pid,
        updatedAt: new Date().toISOString()
      };
      const lockfilePath = path.join(app.getPath("userData"), "mcp-port.json");
      fs.writeFileSync(lockfilePath, JSON.stringify(portData, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(lockfilePath, 0o600);
      console.log(`[Fikr Studio] Wrote MCP port configuration to ${lockfilePath}`);
    } catch (err) {
      console.error("[Fikr Studio] Failed to write mcp-port.json lockfile:", err);
    }
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.warn(`[Fikr Studio] Port ${currentPort} in use — trying next port...`);
      currentPort++;
      if (currentPort < 3125) {
        tryListen(currentPort);
      } else {
        console.error("[Fikr Studio] Failed to find any free port for MCP server after 100 attempts.");
      }
    } else {
      console.error("[Fikr Studio] MCP server error:", e);
    }
  });

  tryListen(currentPort);
  return server;
}

// ─── MCP Ready Promise ────────────────────────────────────────────────────────
let mcpServerReadyResolve;
const mcpServerReadyPromise = new Promise((resolve) => {
  mcpServerReadyResolve = resolve;
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
let mainWindow   = null;
let splashWindow = null;
let mcpServer    = null;
let tray         = null;
let isQuiting    = false;
let isManualUpdateCheck = false;
let isUpdateCheckInFlight = false;
let isUpdateInstallInProgress = false;
let downloadedUpdateReady = false;
let downloadedUpdateError = null;

function showUpdateDialog(options) {
  return dialog.showMessageBox(mainWindow || undefined, options);
}

function getSafeUpdateErrorMessage(err) {
  const message = String(err?.message || err || "Unknown update error");
  if (/404|not found/i.test(message)) {
    return "Fikr Studio could not find update metadata on the published GitHub release.";
  }
  if (/net::|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|network/i.test(message)) {
    return "Fikr Studio could not reach GitHub to check for updates. Check your connection and try again.";
  }
  return "Fikr Studio could not check for updates. Try again later.";
}

function getSafeUpdateInstallErrorMessage(err) {
  const message = String(err?.message || err || "Unknown update install error");
  if (/code signature|SQRLCodeSignature|ShipIt/i.test(message)) {
    return "This copy of Fikr Studio cannot install the downloaded update because its app signature does not match. Replace it with the latest official signed release.";
  }
  return "Fikr Studio could not install the downloaded update. Quit the app and try again.";
}

function checkForUpdates({ manual = false } = {}) {
  if (isUpdateCheckInFlight) {
    if (manual) {
      isManualUpdateCheck = true;
      sendUpdateStatus(mainWindow, true);
    }
    return Promise.resolve(null);
  }

  isManualUpdateCheck = manual;
  isUpdateCheckInFlight = true;

  if (manual) sendUpdateStatus(mainWindow, true);

  return autoUpdater.checkForUpdates()
    .catch(err => {
      console.error("[Fikr Studio] Auto-updater error:", err?.message || err);
      const shouldShowManualError = manual && isManualUpdateCheck;
      if (shouldShowManualError) {
        sendUpdateStatus(mainWindow, false);
        showUpdateDialog({
          type: "error",
          title: "Update Check Failed",
          message: getSafeUpdateErrorMessage(err)
        });
      }
      isManualUpdateCheck = false;
      isUpdateCheckInFlight = false;
      return null;
    });
}

function checkForUpdatesInBackground() {
  return checkForUpdates({ manual: false });
}

/** Buffered progress events sent before the splash page was ready */
let _splashQueue = [];
let _splashReady = false;

/** Send a progress update to the splash screen window */
function splashProgress(phase, label, percent) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const msg = { phase, label, percent };
  if (_splashReady) {
    splashWindow.webContents.send('fikr-studio:splash-progress', msg);
  } else {
    _splashQueue.push(msg);
  }
}

/** Create the splash screen — shown immediately on startup */
function createSplashWindow() {
  _splashReady = false;
  _splashQueue = [];

  splashWindow = new BrowserWindow({
    width: 360,
    height: 280,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  hardenWindow(splashWindow);

  splashWindow.loadFile(path.join(__dirname, 'out/splash.html'));

  // Flush any queued messages once the page is ready to receive them
  splashWindow.webContents.once('did-finish-load', () => {
    _splashReady = true;
    for (const msg of _splashQueue) {
      if (!splashWindow.isDestroyed()) {
        splashWindow.webContents.send('fikr-studio:splash-progress', msg);
      }
    }
    _splashQueue = [];
  });

  splashWindow.on('closed', () => { splashWindow = null; _splashReady = false; });
}


/** Create the main canvas window — starts hidden, shown after startup completes */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,         // hidden until startup sequence completes
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  hardenWindow(mainWindow);

  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL).catch(err => {
      console.error('[Fikr Studio] Failed to connect to dev server:', err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'out/index.html')).catch(err => {
      console.error('[Fikr Studio] Failed to load main window:', err);
    });
  }

  mainWindow.on('close', event => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/**
 * Full startup sequence:
 *  1. Show splash immediately
 *  2. Initialize the deterministic local relevance index
 *  3. If signed in: sync cloud workspace → disk
 *  4. Run embed queue (fill missing vectors from disk)
 *  5. Show main window, close splash
 *
 * Auth note: on first launch the Firebase auth hasn't resolved yet (the renderer
 * drives auth). We give the renderer up to 8 seconds to call set-user — if it
 * doesn't (Free / offline user), we proceed without cloud sync.
 */
async function runStartupSequence() {
  // ── Phase 1: Initialize local relevance index ─────────────────────────────
  splashProgress('loading-model', 'Preparing search index', 5);
  const indexReady = loadEmbeddingModel();

  // ── Phase 2: Wait for auth to resolve (max 8s) ────────────────────────────
  // The renderer fires set-user once onAuthStateChanged resolves.
  // We poll a short-circuit flag that set-user sets.
  splashProgress('syncing', 'Checking account', 20);
  let authWaitMs = 0;
  const AUTH_TIMEOUT = 8000;
  await new Promise(resolve => {
    const poll = setInterval(() => {
      authWaitMs += 200;
      if (authStateResolved || authWaitMs >= AUTH_TIMEOUT) {
        clearInterval(poll);
        resolve(null);
      }
    }, 200);
  });

  // ── Phase 3: Cloud sync (Plus/Pro only) ───────────────────────────────────
  if (currentUserId) {
    splashProgress('syncing', 'Syncing from cloud', 35);
    try {
      const cloudWorkspace = await loadCloudWorkspaceWithFirstSyncSeed();
      if (cloudWorkspace && Array.isArray(cloudWorkspace.projects)) {
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        console.log('[Startup] Cloud workspace synced to disk');
      }
    } catch (err) {
      console.warn('[Startup] Cloud sync failed (non-fatal):', err.message);
    }
  }
  // Cloud load is done (or user is Free/offline) — now allow cloud saves.
  isCloudSyncReady = true;
  console.log('[Startup] Initial cloud state resolved');

  // ── Phase 4: Prepare deterministic relevance vectors ─────────────────────
  splashProgress('loading-model', 'Preparing local search', 55);
  await indexReady;
  splashProgress('embedding', 'Building search index', 70);
  await runEmbedQueue().catch(e => console.warn('[Startup] Embed queue error:', e.message));

  // ── Phase 5: Reveal main window ───────────────────────────────────────────
  splashProgress('ready', 'Ready', 100);
  await new Promise(r => setTimeout(r, 600));  // brief pause so user sees "Ready"

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  // Push synced workspace to renderer now that it's ready
  if (currentUserId && mainWindow) {
    const synced = loadProjectsFromDisk();
    if (synced) pushToRenderer(mainWindow, 'workspace-synced', synced);
  }

  // Mark startup as complete so subsequent set-user calls (e.g. mid-session sign-in)
  // can trigger the post-auth cloud load path.
  isStartupComplete = true;
  scheduleRelayPoll();
  scheduleExternalRelayPoll();

  // Close splash with a short fade delay
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  }, 300);
}

function createTrayIcon() {
  const candidatePaths = [
    path.join(__dirname, "out", "logo-icon.png"),
    path.join(__dirname, "public", "logo-icon.png"),
    path.join(__dirname, "build", "icon.png"),
    path.join(process.resourcesPath || __dirname, "icon.icns"),
  ];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;

    const image = nativeImage.createFromPath(candidatePath);
    if (image.isEmpty()) continue;

    image.setTemplateImage(false);
    return image.resize({ width: 16, height: 16 });
  }

  console.warn("[Tray] No usable tray icon found", candidatePaths);
  return nativeImage.createEmpty();
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  applyRendererContentSecurityPolicy();
  mcpAuthToken = loadOrCreateMcpAuthToken();
  // Show splash immediately — before anything else
  createSplashWindow();

  // Create main window in background (hidden)
  createWindow();
  mcpServer = startMcpServer(mainWindow);

  // ─── System Tray ──────────────────────────────────────────────────────────────
  // Use a scaled-down version of the icon for the tray (ideally 16x16 or 22x22)
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Fikr Studio");
  
  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Open Canvas",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit Fikr Studio",
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(trayMenu);

  // ─── Native Application Menu ──────────────────────────────────────────────────
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { 
          label: 'Check for Updates...', 
          click: () => { 
            checkForUpdates({ manual: true });
          } 
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // ─── OTA Updates ──────────────────────────────────────────────────────────────
  autoUpdater.setFeedURL(UPDATE_FEED);
  checkForUpdatesInBackground();

  autoUpdater.on("error", (err) => {
    console.error("[Fikr Studio] Auto-updater error:", err.message || err);
    if (isUpdateInstallInProgress || downloadedUpdateReady) {
      const wasInstalling = isUpdateInstallInProgress;
      downloadedUpdateReady = false;
      downloadedUpdateError = getSafeUpdateInstallErrorMessage(err);
      isUpdateInstallInProgress = false;
      isQuiting = false;
      if (wasInstalling) {
        showUpdateDialog({
          type: "error",
          title: "Update Install Failed",
          message: downloadedUpdateError
        });
      }
    }
    if (isManualUpdateCheck) {
      sendUpdateStatus(mainWindow, false);
      showUpdateDialog({
        type: "error",
        title: "Update Check Failed",
        message: getSafeUpdateErrorMessage(err)
      });
    }
    isManualUpdateCheck = false;
    isUpdateCheckInFlight = false;
  });

  autoUpdater.on("update-available", () => {
    if (isManualUpdateCheck) {
      sendUpdateStatus(mainWindow, false);
      showUpdateDialog({
        type: "info",
        title: "Update Available",
        message: "A newer Fikr Studio release is available and is downloading now."
      });
    }
    isManualUpdateCheck = false;
    isUpdateCheckInFlight = false;
    console.log("[Fikr Studio] Update available.");
  });

  autoUpdater.on("update-not-available", () => {
    if (isManualUpdateCheck) {
      isManualUpdateCheck = false;
      sendUpdateStatus(mainWindow, false);
      showUpdateDialog({
        type: "info",
        title: "Up to Date",
        message: "You are already running the latest version of Fikr Studio."
      });
    }
    isUpdateCheckInFlight = false;
  });

  autoUpdater.on("update-downloaded", () => {
    sendUpdateStatus(mainWindow, false);
    isManualUpdateCheck = false;
    isUpdateCheckInFlight = false;
    downloadedUpdateReady = true;
    downloadedUpdateError = null;
    console.log("[Fikr Studio] Update downloaded. Ready to install.");
    showUpdateDialog({
      type: "info",
      title: "Update Ready",
      message: "A new version of Fikr Studio has been downloaded. Quit and install now?",
      buttons: ["Quit and Install", "Later"]
    }).then(result => {
      if (result.response === 0) {
        if (!downloadedUpdateReady) {
          showUpdateDialog({
            type: "error",
            title: "Update Install Failed",
            message: downloadedUpdateError || "The downloaded update is no longer available. Check for updates again."
          });
          return;
        }
        isQuiting = true;
        isUpdateInstallInProgress = true;
        downloadedUpdateReady = false;
        installDownloadedUpdate({
          session: session.defaultSession,
          quitAndInstall: () => autoUpdater.quitAndInstall(),
          onFlushError: error => {
            console.warn('[Fikr Studio] Could not flush session storage before update:', error?.message || error);
          },
        }).catch(error => {
          isUpdateInstallInProgress = false;
          isQuiting = false;
          downloadedUpdateError = getSafeUpdateInstallErrorMessage(error);
          console.error('[Fikr Studio] Could not install downloaded update:', error?.message || error);
          showUpdateDialog({
            type: 'error',
            title: 'Update Install Failed',
            message: downloadedUpdateError,
          });
        });
      }
    });
  });

  // Run the startup sequence: search setup → cloud sync → index queue → show window.
  runStartupSequence().catch(err => {
    console.error('[Startup] Startup sequence failed:', err.message);
    // Ensure main window shows even if startup fails
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

app.on("window-all-closed", () => {
  // Do not quit, stay running in background
});

app.on("before-quit", () => {
  isQuiting = true;
  closePendingAuthServer();
  if (mcpServer) mcpServer.close();
  if (relayPollTimer) clearTimeout(relayPollTimer);
  if (externalRelayPollTimer) clearTimeout(externalRelayPollTimer);
  try {
    const lockfilePath = path.join(app.getPath("userData"), "mcp-port.json");
    if (fs.existsSync(lockfilePath)) {
      fs.unlinkSync(lockfilePath);
      console.log("[Fikr Studio] Cleaned up MCP port lockfile on exit.");
    }
  } catch (err) {
    console.error("[Fikr Studio] Failed to clean up MCP port lockfile:", err);
  }
});
