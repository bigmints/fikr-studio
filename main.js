const { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray, nativeImage, safeStorage } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");

// ─── Studio Firestore layer (studio_projects / studio_notes collections) ──────
// Completely separate from the Fikr Flutter app's users/{uid}/notes collection.
const dc = require('./lib/studio-firestore');

/** Firebase UID of the currently signed-in user (null = offline / Free) */
let currentUserId = null;

/** Firebase ID token for calling fikr.one APIs (refreshed on auth state change) */
let currentIdToken = null;

/**
 * True once runStartupSequence() has finished.
 * During startup, set-user feeds auth into the sequence but skips the
 * post-auth cloud load (runStartupSequence handles that itself).
 */
let isStartupComplete = false;

/**
 * True once the startup cloud load has completed (or we confirmed user is offline/Free).
 * Blocks all Firestore saves until we know what the cloud state is.
 * Without this gate the renderer's initial disk-state save fires before the cloud
 * data arrives, potentially overwriting cloud data from another device.
 */
let isCloudSyncReady = false;

/** Whether the user is signed in as Plus/Pro (uid present = cloud sync enabled) */
async function setCurrentUser(uid, idToken) {
  const prev = currentUserId;
  currentUserId = uid;
  currentIdToken = idToken ?? null;
  if (prev !== uid) {
    console.log(uid ? `[DataConnect] User signed in: ${uid}` : '[DataConnect] User signed out — local mode');
  }
}


process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// In dev mode (launched by electron:dev) Electron loads from the Next.js HMR
// dev server instead of the static export in out/.
const IS_DEV = process.env.ELECTRON_IS_DEV === '1';
const DEV_SERVER_URL = 'http://localhost:3741';


if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("fikr-studio", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
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
    if (url) {
      const parsed = new URL(url);
      if (parsed.hostname === "auth" && parsed.pathname === "/callback") {
        const token = parsed.searchParams.get("token");
        if (token && mainWindow) {
          pushToRenderer(mainWindow, "auth-token", { token });
        }
      }
    }
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MCP_PORT = 3025;
const WORKSPACE_DIR = path.join(app.getPath("home"), ".fikr-studio");
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.json");
const INTRO_FILE = path.join(WORKSPACE_DIR, "intro-seen");
const MODEL_CACHE_DIR = path.join(WORKSPACE_DIR, "models");
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

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


/** Resolves to the pipeline once the model is loaded */
let pipelineReady = null;

/**
 * Load the sentence embedding model.
 * Model weights (~25MB) are cached in ~/.fikr-studio/models/ so subsequent
 * launches load instantly from disk.
 */
function loadEmbeddingModel() {
  // Dynamic import — @xenova/transformers is ESM-only inside its pipeline helper
  pipelineReady = (async () => {
    try {
      ensureWorkspaceDir();
      if (!fs.existsSync(MODEL_CACHE_DIR)) fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });

      const { pipeline, env } = await import("@xenova/transformers");
      env.cacheDir = MODEL_CACHE_DIR;
      env.allowLocalModels = true;

      const extractor = await pipeline("feature-extraction", EMBED_MODEL, {
        quantized: true,   // use INT8 quantized weights (~6MB instead of 25MB)
      });
      console.log("[Fikr Studio] Embedding model ready:", EMBED_MODEL);
      return extractor;
    } catch (e) {
      console.error("[Fikr Studio] Failed to load embedding model:", e);
      return null;
    }
  })();
  return pipelineReady;
}

/** Generate a 384-dim float32 embedding for a text string. Returns null on failure. */
async function embedText(text) {
  try {
    const extractor = await pipelineReady;
    if (!extractor) return null;
    const output = await extractor(text, { pooling: "mean", normalize: true });
    // output.data is a Float32Array — convert to plain Array for JSON serialisation
    return Array.from(output.data);
  } catch (e) {
    console.error("[Fikr Studio] Embedding failed:", e.message);
    return null;
  }
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
 * Re-embeds any note in the workspace that is missing an embedding.
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
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

function loadProjectsFromDisk() {
  ensureWorkspaceDir();
  try {
    if (fs.existsSync(WORKSPACE_FILE)) {
      return JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[Fikr Studio] Failed to load workspace:", e);
  }
  return null;
}

function saveProjectsToDisk(data) {
  ensureWorkspaceDir();
  try {
    fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("[Fikr Studio] Failed to save workspace:", e);
    return false;
  }
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

/**
 * Load projects — from Data Connect if signed in, else fall back to local disk.
 * Always also write through to local disk as offline cache.
 */
ipcMain.handle("fikr-studio:load-projects", async () => {
  // Plus/Pro: load from Data Connect, fall back to local disk cache on failure
  if (currentUserId) {
    try {
      const workspace = await dc.loadWorkspace(currentUserId);
      if (workspace) {
        updateLastSyncedIds(workspace);
        saveProjectsToDisk(workspace); // keep local cache warm
        return workspace;
      }
    } catch (err) {
      console.error('[DataConnect] load-projects failed, using local cache:', err.message);
    }
  }
  // Free / offline
  const data = loadProjectsFromDisk();
  updateLastSyncedIds(data);
  return data;
});

/**
 * Save projects — to Data Connect if signed in, always to local disk.
 */
ipcMain.handle("fikr-studio:save-projects", async (_event, data) => {
  const ok = saveProjectsToDisk(data);  // always write local cache
  scheduleEmbedQueue();  // debounced — at most once per 30s
  // Plus/Pro: background sync to Firestore — only after startup cloud load is done.
  // If we haven't loaded from cloud yet, we don't know what the authoritative state
  // is — saving now risks overwriting another device's data with our stale disk cache.
  if (currentUserId && isCloudSyncReady) {
    dc.saveWorkspace(currentUserId, data, lastSyncedNoteIds, lastSyncedProjectIds, lastSyncedGenProjectIds)
      .then(() => {
        updateLastSyncedIds(data);
        triggerServerEmbed(data);
      })
      .catch((err) => {
        console.error('[DataConnect] save-projects sync failed:', err.message);
      });
  } else if (currentUserId && !isCloudSyncReady) {
    console.log('[DataConnect] save-projects: blocking Firestore write — cloud sync not ready yet');
  }
  return ok;
});
ipcMain.handle("fikr-studio:get-mcp-port", () => MCP_PORT);
ipcMain.handle("fikr-studio:open-auth", async () => {
  shell.openExternal("https://www.fikr.one/login?returnUrl=fikr-studio://auth/callback");
});

/**
 * Called by the renderer whenever Firebase Auth state changes.
 * uid = null means the user signed out.
 * On sign-in: loads from Firestore and pushes to renderer (fixes race
 * condition where loadProjects fires before auth resolves).
 */
ipcMain.handle("fikr-studio:set-user", async (_event, { uid, idToken }) => {
  const wasSignedIn = !!currentUserId;
  await setCurrentUser(uid ?? null, idToken ?? null);

  if (!uid) {
    // User signed out — reset the gate so if they sign back in we re-load from cloud
    // before allowing any Firestore saves.
    isCloudSyncReady = false;
    return true;
  }

  // Only trigger a post-auth cloud load if startup is already complete.
  // During startup, runStartupSequence() handles the sync itself.
  if (uid && !wasSignedIn && mainWindow && isStartupComplete) {
    try {
      const cloudWorkspace = await dc.loadWorkspace(uid);
      if (cloudWorkspace && cloudWorkspace.projects && cloudWorkspace.projects.length > 0) {
        // If cloud has no studioProjects yet, preserve whatever is on local disk
        // so the Studio tab isn't wiped while gen projects are still being synced.
        if (!cloudWorkspace.studioProjects || cloudWorkspace.studioProjects.length === 0) {
          const disk = loadProjectsFromDisk();
          cloudWorkspace.studioProjects        = disk?.studioProjects        ?? [];
          cloudWorkspace.activeStudioProjectId = disk?.activeStudioProjectId ?? '';
        }
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        pushToRenderer(mainWindow, "workspace-synced", cloudWorkspace);
        console.log('[DataConnect] Post-auth workspace pushed to renderer');
        // Trigger server-side embedding for any notes not yet embedded
        triggerServerEmbed(cloudWorkspace).catch(e =>
          console.warn('[Fikr Studio] Post-auth embed failed:', e.message)
        );
      }
    } catch (err) {
      console.error('[DataConnect] Post-auth load failed:', err.message);
    } finally {
      // Allow saves now that we have the authoritative cloud state
      isCloudSyncReady = true;
      console.log('[DataConnect] isCloudSyncReady = true after post-auth load');
    }
  }
  return true;
});


ipcMain.handle("fikr-studio:sync-workspace", async () => {
  if (currentUserId) {
    try {
      const cloudWorkspace = await dc.loadWorkspace(currentUserId);
      if (cloudWorkspace && cloudWorkspace.projects && cloudWorkspace.projects.length > 0) {
        if (!cloudWorkspace.studioProjects || cloudWorkspace.studioProjects.length === 0) {
          const disk = loadProjectsFromDisk();
          cloudWorkspace.studioProjects        = disk?.studioProjects        ?? [];
          cloudWorkspace.activeStudioProjectId = disk?.activeStudioProjectId ?? '';
        }
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        if (mainWindow) {
          pushToRenderer(mainWindow, "workspace-synced", cloudWorkspace);
        }
        return { success: true };
      }
      return { success: false, error: 'No projects found in cloud' };
    } catch (err) {
      console.error('[DataConnect] Manual sync failed:', err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Not signed in' };
});

/**
 * Proper logout flow:
 * 1. If the user is signed in (Plus/Pro), attempt a final sync to Firestore.
 * 2. Show a native dialog: "Keep local data" vs "Clear everything".
 * 3. If the user picks "Clear", delete workspace.json and clear studio localStorage key.
 * 4. Tell the renderer to reset its state, then the renderer calls Firebase signOut.
 *
 * Returns { cleared: boolean } so the renderer knows what to do next.
 */
ipcMain.handle("fikr-studio:logout", async (_event, { currentData } = {}) => {
  // ── Step 1: Final cloud sync (best-effort, don't block logout) ────────────
  if (currentUserId && currentData) {
    try {
      await dc.saveWorkspace(currentUserId, currentData);
      console.log('[Logout] Final sync to Firestore completed for', currentUserId);
    } catch (err) {
      console.warn('[Logout] Final sync failed (continuing):', err.message);
    }
  }

  // ── Step 2: Show native keep/clear dialog ─────────────────────────────────
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Signing out',
    message: 'What should happen to your local data?',
    detail: 'Your cloud data is safe either way. This only affects what is stored on this device.',
    buttons: ['Keep local data', 'Clear everything', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    icon: undefined,
  });

  // response 2 = Cancel — abort logout
  if (response === 2) {
    return { cleared: false, cancelled: true };
  }

  const clearLocal = response === 1; // "Clear everything"

  // ── Step 3: Optionally wipe local cache ───────────────────────────────────
  if (clearLocal) {
    try {
      if (fs.existsSync(WORKSPACE_FILE)) {
        fs.unlinkSync(WORKSPACE_FILE);
        console.log('[Logout] workspace.json deleted');
      }
    } catch (err) {
      console.warn('[Logout] Failed to delete workspace.json:', err.message);
    }
  }

  // ── Step 4: Clear the in-memory user so future saves don't cloud-sync ─────
  await setCurrentUser(null);

  // Push reset event so renderer re-initialises with empty / fresh state
  if (clearLocal && mainWindow) {
    pushToRenderer(mainWindow, 'workspace-cleared', {});
  }

  return { cleared: clearLocal, cancelled: false };
});

ipcMain.handle("fikr-studio:open-url", async (_event, url) => {
  shell.openExternal(url);
});
ipcMain.handle("fikr-studio:execute-tool", async (event, { name, args }) => {
  return await executeTool(name, args, mainWindow);
});
ipcMain.handle("fikr-studio:get-intro-seen", () => fs.existsSync(INTRO_FILE));
ipcMain.handle("fikr-studio:set-intro-seen", () => {
  ensureWorkspaceDir();
  fs.writeFileSync(INTRO_FILE, "1");
  return true;
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
    const configPath = getMcpConfigPath(client);
    if (!configPath) throw new Error("Unknown client");

    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let config = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); }
      catch { config = { mcpServers: {} }; }
    }
    if (!config.mcpServers) config.mcpServers = {};

    // Find a Node >=20 npx from nvm to avoid Node v14 compatibility errors.
    // The system PATH may point to an old Node; nvm version dirs are more reliable.
    const npxCommand = findCompatibleNpx();

    const isDev = process.env.ELECTRON_IS_DEV === "1";
    if (isDev) {
      console.log("[Fikr Studio] Using local script for MCP install (dev mode)");
      config.mcpServers["fikr-studio"] = {
        command: "node",
        args: [path.join(__dirname, "scripts", "mcp-bridge.mjs"), `http://localhost:${MCP_PORT}/sse`]
      };
    } else {
      console.log("[Fikr Studio] Using npx for MCP install:", npxCommand);
      config.mcpServers["fikr-studio"] = {
        command: npxCommand,
        args: ["-y", "fikr-studio-mcp@latest", `http://localhost:${MCP_PORT}/sse`]
      };
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  });

  ipcMain.handle("fikr-studio:uninstall-mcp", async (_event, client) => {
    const configPath = getMcpConfigPath(client);
    if (!configPath || !fs.existsSync(configPath)) return false;

    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.mcpServers && config.mcpServers["fikr-studio"]) {
        delete config.mcpServers["fikr-studio"];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fikr-studio:test-mcp", async (_event, client) => {
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
          headers: { Accept: "text/event-stream" }, timeout: 3000 },
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

  ipcMain.handle("fikr-studio:get-usage", async (_event, token) => {
    try {
      const fetchModule = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      // Using global fetch if available (Node 18+), fallback to node-fetch if we imported it in another way or it's not available
      const doFetch = typeof fetch !== 'undefined' ? fetch : fetchModule;
      
      const res = await doFetch("https://fikr.one/api/user/usage", {
        headers: { Authorization: `Bearer ${token}` },
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
    description: "Add a new note/thought to the active Fikr Studio canvas. The local AI will automatically classify and enrich it.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The raw text content of the note" },
        project_id: { type: "string", description: "Target project ID. Omit to use the first project." },
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
    description: "Add a pre-synthesized note to Fikr Studio. Use this when you have already enriched the note using the fikr-studio-skill pre-synthesis step. Fikr Studio will vectorize and store it immediately without running its own AI enrichment pass. The note will appear on the canvas instantly as fully annotated.",
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
  const workspace = loadProjectsFromDisk() || { projects: [], activeProjectId: "" };
  // Support both the new { projects, activeProjectId } shape and a legacy raw array
  const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
  const save = () => {
    const data = Array.isArray(workspace) ? projects : { ...workspace, projects };
    saveProjectsToDisk(data);  // always write local cache
    scheduleEmbedQueue();  // debounced
    // Plus/Pro: background sync to Data Connect
    if (currentUserId) {
      dc.saveWorkspace(currentUserId, data).catch((err) => {
        console.error('[DataConnect] MCP sync failed:', err.message);
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

      // ── Tier 1: Local semantic search (Xenova all-MiniLM-L6-v2, 384-dim) ──
      // Fully offline. The Electron app is the AI brain — no server calls.
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

      // ── Tier 2: Keyword fallback (Xenova model not yet loaded) ─────────────
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
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const newNote = {
        id: generateId(),
        text: args.text,
        timestamp: Date.now(),
        contentType: "general",
        isEnriching: true, // Let the frontend auto-enrich
        fromMcp: true,
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
          text: `Pre-synthesized note stored with id: ${newNote.id} in project "${proj.name}". Type: ${newNote.contentType}, Category: "${newNote.category}". Embedding: ${embedding ? `generated (${embedding.length} dims)` : "skipped — model not ready yet, will be embedded on next save"}.`
        }],
      };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

// ─── Direct MCP Execution via IPC ─────────────────────────────────────────────
ipcMain.handle("fikr-studio:execute-mcp", async (event, rpc) => {
  switch (rpc.method) {
    case "initialize":
      console.log("[Fikr Studio] IPC received initialize!");
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
      console.log(`[Fikr Studio] Received MCP notification: ${rpc.method}`, rpc.params || "");
      return null; // Notifications have no response

    // Optional MCP methods — not implemented, acknowledge gracefully
    case "resources/subscribe":
    case "resources/unsubscribe":
      return { jsonrpc: "2.0", id: rpc.id, result: {} };

    default:
      throw new Error(`Method not found: ${rpc.method}`);
  }
});

/** Start the MCP HTTP/SSE server */
function startMcpServer(mainWindow) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${MCP_PORT}`);

    // ── CORS ──────────────────────────────────────────────────────────────────
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── SSE endpoint (MCP transport) ──────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sessionId = Math.random().toString(36).substring(2, 15);
      sseSessions.set(sessionId, res);

      // Send the MCP server info on connect
      const send = (event, data) => res.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);

      send("endpoint", `/message?sessionId=${sessionId}`);
      
      req.on("close", () => sseSessions.delete(sessionId));
      return;
    }

    // ── JSON-RPC message endpoint ─────────────────────────────────────────────
    if (req.method === "POST") {
      console.log("[Fikr Studio] POST request to:", req.url);
      
      if (url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId");
        const sseRes = sseSessions.get(sessionId);

        if (!sseRes) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Session not found");
          return;
        }

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        let rpc;
        try {
          rpc = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid JSON");
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

        switch (rpc.method) {
          case "initialize":
            respondSse({
              protocolVersion: "2024-11-05",
              capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } },
              serverInfo: { name: "fikr-studio", version: "1.0.0" },
            });
            break;

          case "prompts/list":
            respondSse({
              prompts: [
                {
                  name: "pre_synthesis",
                  description: "Instructions for performing local AI note synthesis and classification before storing in Fikr Studio",
                  arguments: [
                    { name: "text", description: "The raw text of the note to synthesize", required: true }
                  ]
                }
              ]
            });
            break;

          case "prompts/get": {
            if (rpc.params?.name === "pre_synthesis") {
              respondSse({
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
              });
            } else {
              respondErrorSse(-32602, "Unknown prompt");
            }
            break;
          }

          case "tools/list":
            respondSse({ tools: MCP_TOOLS });
            break;

          case "tools/call": {
            const { name, arguments: args } = rpc.params || {};
            executeTool(name, args || {}, mainWindow)
              .then(result => respondSse(result))
              .catch(err => respondErrorSse(-32603, err.message || "Internal error"));
            return;
          }

          case "resources/list":
            respondSse({
              resources: [
                { uri: "fikr-studio://projects", name: "All Projects", description: "Full workspace dump", mimeType: "application/json" },
              ],
            });
            break;

          case "resources/read": {
            if (rpc.params?.uri === "fikr-studio://projects") {
              const workspace = loadProjectsFromDisk() || { projects: [] };
              const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
              respondSse({ contents: [{ uri: "fikr-studio://projects", mimeType: "application/json", text: JSON.stringify(projects, null, 2) }] });
            } else {
              respondErrorSse(-32602, "Unknown resource URI");
            }
            break;
          }

          case "notifications/initialized":
            // Notifications don't require a response
            break;

          default:
            // Could be a notification like ping, only respond if there is an ID
            if (rpc.id !== undefined) {
              respondErrorSse(-32601, `Method not found: ${rpc.method}`);
            }
        }
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
      "args": ["-y", "fikr-studio-mcp@latest", "http://localhost:${MCP_PORT}/sse"]
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
      "url": "http://localhost:${MCP_PORT}/sse",
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
      "serverUrl": "http://localhost:${MCP_PORT}/sse"
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
      "httpUrl": "http://localhost:${MCP_PORT}/sse"
    }
  }
}
\`\`\`

## Step 3 — Available Tools (call these via MCP)

| Tool | Description |
|------|-------------|
| \`create_note\` | Add a note to the active canvas |
| \`search_notes\` | Semantic + keyword search across all notes |
| \`get_canvas\` | Read all notes from a project |
| \`list_projects\` | List all Fikr spaces |
| \`update_note\` | Edit an existing note |
| \`delete_note\` | Remove a note by ID |
| \`get_synthesis\` | Read AI-generated insight clusters |
| \`create_note_synthesized\` | Add a pre-enriched, classified note |

## Step 4 — Synthesis Skill
After connecting, fetch and follow the synthesis skill:
\`\`\`
curl http://localhost:${MCP_PORT}/skills/synthesis.md
\`\`\`

## Step 5 — Auto-Summary Skill
To enable automatic summaries after major canvas changes:
\`\`\`
curl http://localhost:${MCP_PORT}/skills/auto-summary.md
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

      const AUTO_SUMMARY_SKILL = `# Fikr Studio — Auto-Summary Skill

> Use this skill to generate and post canvas summaries after major changes.

## What this skill does
After significant canvas activity, this skill:
1. Reads the active canvas (\`get_canvas\`)
2. Reads AI-generated insights (\`get_synthesis\`)
3. Generates a structured summary
4. Posts it to a connected channel (Slack, Discord, Telegram, or saves as a new note)

## Trigger conditions — when to run
- After 10+ notes added in a session
- After a batch synthesis pass completes
- On a scheduled cadence (daily at end of day, weekly on Friday)
- When explicitly asked: "summarise my canvas"

## Step-by-step

### 1. Gather canvas state
\`\`\`
call get_canvas → store notes
call get_synthesis → store insight clusters
\`\`\`

### 2. Generate the summary
Structure the summary as:
\`\`\`
## Fikr Canvas Summary — [date]

**Active project**: [project name]
**Notes this session**: [count]
**Top categories**: [list top 3 categories by count]

### Key Insights
[Pull top 3-5 ghost/synthesis notes — these are the AI-generated patterns]

### Notable Notes
[Pull 3-5 notes with highest confidence annotation]

### Open Questions
[Pull all notes classified as "question"]
\`\`\`

### 3. Post the summary

#### To Slack (if configured)
\`\`\`
POST https://hooks.slack.com/services/YOUR_WEBHOOK_URL
Content-Type: application/json
{"text": "[your summary]"}
\`\`\`

#### To Discord (if configured)
\`\`\`
POST https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
Content-Type: application/json
{"content": "[your summary]"}
\`\`\`

#### Save as a note (always safe)
Call \`create_note_synthesized\` with:
- text: the summary markdown
- contentType: "narrative"
- category: "Weekly Summary"
- annotation: "Auto-generated canvas summary for [date]"

## Autonomous weekly digest
To generate a weekly digest every Friday:
1. Call \`get_canvas\` across all projects
2. Filter notes from the past 7 days (check \`timestamp\` field)
3. Generate summary per project
4. Post to your configured channel
5. Call \`create_note_synthesized\` to archive the digest on the canvas
`;

      const routes = {
        "/skill.md": MASTER_SKILL,
        "/skills/synthesis.md": SYNTHESIS_SKILL,
        "/skills/auto-summary.md": AUTO_SUMMARY_SKILL,
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

  server.listen(MCP_PORT, "127.0.0.1", () => {
    console.log(`[Fikr Studio] MCP server running at http://localhost:${MCP_PORT}`);
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.warn(`[Fikr Studio] Port ${MCP_PORT} in use — MCP server not started`);
    } else {
      console.error("[Fikr Studio] MCP server error:", e);
    }
  });

  return server;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
let mainWindow   = null;
let splashWindow = null;
let mcpServer    = null;
let tray         = null;
let isQuiting    = false;
let isManualUpdateCheck = false;

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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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
 *  2. Load embedding model (may download ~6MB on first run)
 *  3. If signed in: sync cloud workspace → disk
 *  4. Run embed queue (fill missing vectors from disk)
 *  5. Show main window, close splash
 *
 * Auth note: on first launch the Firebase auth hasn't resolved yet (the renderer
 * drives auth). We give the renderer up to 8 seconds to call set-user — if it
 * doesn't (Free / offline user), we proceed without cloud sync.
 */
async function runStartupSequence() {
  // ── Phase 1: Load embedding model ─────────────────────────────────────────
  splashProgress('loading-model', 'Loading AI model', 5);
  const modelPromise = loadEmbeddingModel();

  // ── Phase 2: Wait for auth to resolve (max 8s) ────────────────────────────
  // The renderer fires set-user once onAuthStateChanged resolves.
  // We poll a short-circuit flag that set-user sets.
  splashProgress('syncing', 'Checking account', 20);
  let authWaitMs = 0;
  const AUTH_TIMEOUT = 8000;
  await new Promise(resolve => {
    const poll = setInterval(() => {
      authWaitMs += 200;
      if (currentUserId || authWaitMs >= AUTH_TIMEOUT) {
        clearInterval(poll);
        resolve(null);
      }
    }, 200);
  });

  // ── Phase 3: Cloud sync (Plus/Pro only) ───────────────────────────────────
  if (currentUserId) {
    splashProgress('syncing', 'Syncing from cloud', 35);
    try {
      const cloudWorkspace = await dc.loadWorkspace(currentUserId);
      if (cloudWorkspace && cloudWorkspace.projects && cloudWorkspace.projects.length > 0) {
        if (!cloudWorkspace.studioProjects || cloudWorkspace.studioProjects.length === 0) {
          const disk = loadProjectsFromDisk();
          cloudWorkspace.studioProjects        = disk?.studioProjects        ?? [];
          cloudWorkspace.activeStudioProjectId = disk?.activeStudioProjectId ?? '';
        }
        saveProjectsToDisk(cloudWorkspace);
        updateLastSyncedIds(cloudWorkspace);
        console.log('[Startup] Cloud workspace synced to disk');
      }
    } catch (err) {
      console.warn('[Startup] Cloud sync failed (non-fatal):', err.message);
    }
  }
  // Cloud load is done (or user is Free/offline) — now allow Firestore saves.
  isCloudSyncReady = true;
  console.log('[Startup] isCloudSyncReady = true — Firestore saves unblocked');

  // ── Phase 4: Wait for model + run embed queue ─────────────────────────────
  splashProgress('loading-model', 'Warming up AI model', 55);
  await modelPromise;  // ensure model is loaded before embedding
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

  // Close splash with a short fade delay
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  }, 300);
}

app.whenReady().then(async () => {
  // Show splash immediately — before anything else
  createSplashWindow();

  // Create main window in background (hidden)
  createWindow();
  mcpServer = startMcpServer(mainWindow);

  // ─── System Tray ──────────────────────────────────────────────────────────────
  const iconPath = path.join(__dirname, "build/icon.png");
  // Use a scaled-down version of the icon for the tray (ideally 16x16 or 22x22)
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip("Fikr Studio Background Sync");
  
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
            isManualUpdateCheck = true; 
            autoUpdater.checkForUpdates(); 
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
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("error", (err) => {
    console.error("[Fikr Studio] Auto-updater error:", err.message || err);
  });

  autoUpdater.on("update-available", () => {
    isManualUpdateCheck = false;
    console.log("[Fikr Studio] Update available.");
  });

  autoUpdater.on("update-not-available", () => {
    if (isManualUpdateCheck) {
      isManualUpdateCheck = false;
      dialog.showMessageBox({
        type: "info",
        title: "Up to Date",
        message: "You are already running the latest version of Fikr Studio."
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[Fikr Studio] Update downloaded. Ready to install.");
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "A new version of Fikr Studio has been downloaded. Quit and install now?",
      buttons: ["Quit and Install", "Later"]
    }).then(result => {
      if (result.response === 0) {
        isQuiting = true;
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 100);
      }
    });
  });

  // Run the startup sequence: model load → cloud sync → embed queue → show main window
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
  const parsed = new URL(url);
  if (parsed.hostname === "auth" && parsed.pathname === "/callback") {
    const token = parsed.searchParams.get("token");
    if (token && mainWindow) {
      pushToRenderer(mainWindow, "auth-token", { token });
    }
  }
});

app.on("window-all-closed", () => {
  // Do not quit, stay running in background
});

app.on("before-quit", () => {
  isQuiting = true;
  if (mcpServer) mcpServer.close();
});
