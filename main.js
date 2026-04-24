const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

// ─── Constants ────────────────────────────────────────────────────────────────
const MCP_PORT = 3025;
const WORKSPACE_DIR = path.join(app.getPath("home"), ".fikrpad");
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.json");
const INTRO_FILE = path.join(WORKSPACE_DIR, "intro-seen");
const MODEL_CACHE_DIR = path.join(WORKSPACE_DIR, "models");
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

// ─── Embedding pipeline ───────────────────────────────────────────────────────
/** Resolves to the pipeline once the model is loaded */
let pipelineReady = null;

/**
 * Load the sentence embedding model.
 * Model weights (~25MB) are cached in ~/.fikrpad/models/ so subsequent
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
      console.log("[FikrPad] Embedding model ready:", EMBED_MODEL);
      return extractor;
    } catch (e) {
      console.error("[FikrPad] Failed to load embedding model:", e);
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
    console.error("[FikrPad] Embedding failed:", e.message);
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
 * Called after every save so new notes created by the React app get embedded too.
 */
let embedQueueRunning = false;
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
      console.log("[FikrPad] Embedding queue flushed — workspace updated");
    }
  } finally {
    embedQueueRunning = false;
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
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
    console.error("[FikrPad] Failed to load workspace:", e);
  }
  return null;
}

function saveProjectsToDisk(data) {
  ensureWorkspaceDir();
  try {
    fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("[FikrPad] Failed to save workspace:", e);
    return false;
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle("fikrpad:load-projects", () => loadProjectsFromDisk());
ipcMain.handle("fikrpad:save-projects", async (_event, data) => {
  const ok = saveProjectsToDisk(data);
  // Kick off background embedding after every save (non-blocking)
  runEmbedQueue().catch(console.error);
  return ok;
});
ipcMain.handle("fikrpad:get-mcp-port", () => MCP_PORT);
ipcMain.handle("fikrpad:get-intro-seen", () => fs.existsSync(INTRO_FILE));
ipcMain.handle("fikrpad:set-intro-seen", () => {
  ensureWorkspaceDir();
  fs.writeFileSync(INTRO_FILE, "1");
  return true;
});

// ─── MCP Server ───────────────────────────────────────────────────────────────
/** Active SSE clients (for pushing events to connected MCP clients) */
const sseClients = new Set();

/** The tool definitions advertised to MCP clients */
const MCP_TOOLS = [
  {
    name: "create_note",
    description: "Add a new note/thought to the active FikrPad canvas. The note will be automatically classified and enriched by the AI.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text content of the note" },
        project_id: { type: "string", description: "Target project ID. Omit to use the first project." },
        type: {
          type: "string",
          description: "Optional type hint: claim, question, idea, task, quote, reference, definition, opinion, reflection, narrative, comparison, thesis, entity, general",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "search_notes",
    description: "Search notes across a FikrPad project using keyword matching",
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
    description: "Get all notes from a FikrPad project/canvas",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID. Omit for the first/active project." },
      },
    },
  },
  {
    name: "list_projects",
    description: "List all FikrPad projects/spaces with their IDs and names",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_project",
    description: "Create a new FikrPad project/space",
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
    description: "Remove a note from FikrPad by its ID",
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
    description: "Edit the text of an existing note in FikrPad",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note ID to update" },
        new_text: { type: "string", description: "Replacement text" },
        project_id: { type: "string", description: "Project ID containing the note" },
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
];

/** Push an event to the React renderer so the canvas updates live */
function pushToRenderer(mainWindow, type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("fikrpad:external-event", { type, payload });
  }
}

/** Execute an MCP tool call and return the result */
async function executeTool(name, args, mainWindow) {
  const workspace = loadProjectsFromDisk() || { projects: [], activeProjectId: "" };
  // Support both the new { projects, activeProjectId } shape and a legacy raw array
  const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
  const save = () => saveProjectsToDisk(Array.isArray(workspace) ? projects : { ...workspace, projects });

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
      const query = args.query || "";
      const limit = args.limit || 10;
      const searchIn = args.project_id ? [getProject(args.project_id)].filter(Boolean) : projects;

      // Try semantic (vector) search first
      const queryEmbedding = await embedText(query);

      if (queryEmbedding) {
        // ── Semantic search: rank by cosine similarity ───────────────────────
        const scored = [];
        for (const proj of searchIn) {
          for (const b of proj.blocks || []) {
            if (!b.text) continue;
            const sim = b.embedding
              ? cosineSimilarity(queryEmbedding, b.embedding)
              : 0; // not yet embedded — will be 0, still included with text fallback
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
        // Sort by similarity descending, take top-k with score > 0.2
        const results = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .filter(r => r.score > 0.2)
          .map(({ score, ...rest }) => ({ ...rest, similarity: Math.round(score * 100) / 100 }));

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } else {
        // ── Fallback: keyword search (model not loaded yet) ─────────────────
        const q = query.toLowerCase();
        const results = [];
        for (const proj of searchIn) {
          for (const b of proj.blocks || []) {
            const haystack = `${b.text} ${b.annotation || ""} ${b.category || ""}`.toLowerCase();
            if (haystack.includes(q)) {
              results.push({ project: proj.name, project_id: proj.id, id: b.id, text: b.text, type: b.contentType, annotation: b.annotation });
              if (results.length >= limit) break;
            }
          }
          if (results.length >= limit) break;
        }
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
    }

    case "create_note": {
      const proj = getProject(args.project_id);
      if (!proj) return { content: [{ type: "text", text: "Project not found" }], isError: true };
      const newNote = {
        id: generateId(),
        text: args.text,
        timestamp: Date.now(),
        contentType: args.type || "general",
        isEnriching: true,
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
      note.isEnriching = true;
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

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

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

      // Send the MCP server info on connect
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      send("endpoint", { uri: `http://localhost:${MCP_PORT}/message` });
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // ── JSON-RPC message endpoint ─────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/message") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        let rpc;
        try {
          rpc = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        const respond = (result) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };

        const respondError = (code, message) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code, message } }));
        };

        switch (rpc.method) {
          case "initialize":
            respond({
              protocolVersion: "2024-11-05",
              capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } },
              serverInfo: { name: "fikrpad", version: "1.0.0" },
            });
            break;

          case "tools/list":
            respond({ tools: MCP_TOOLS });
            break;

          case "tools/call": {
            const { name, arguments: args } = rpc.params;
            // executeTool is async (embeddings) — resolve before responding
            executeTool(name, args || {}, mainWindow)
              .then(result => respond(result))
              .catch(err => respondError(-32603, err.message || "Internal error"));
            return; // response sent inside promise
          }

          case "resources/list":
            respond({
              resources: [
                { uri: "fikrpad://projects", name: "All Projects", description: "Full workspace dump", mimeType: "application/json" },
              ],
            });
            break;

          case "resources/read": {
            if (rpc.params?.uri === "fikrpad://projects") {
              const workspace = loadProjectsFromDisk() || { projects: [] };
              const projects = Array.isArray(workspace) ? workspace : (workspace.projects || []);
              respond({ contents: [{ uri: "fikrpad://projects", mimeType: "application/json", text: JSON.stringify(projects, null, 2) }] });
            } else {
              respondError(-32602, "Unknown resource URI");
            }
            break;
          }

          case "notifications/initialized":
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: {} }));
            break;

          default:
            respondError(-32601, `Method not found: ${rpc.method}`);
        }
      });
      return;
    }

    // ── Health check ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "fikrpad-mcp", port: MCP_PORT }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(MCP_PORT, "127.0.0.1", () => {
    console.log(`[FikrPad] MCP server running at http://localhost:${MCP_PORT}`);
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.warn(`[FikrPad] Port ${MCP_PORT} in use — MCP server not started`);
    } else {
      console.error("[FikrPad] MCP server error:", e);
    }
  });

  return server;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
let mainWindow = null;
let mcpServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const url = `file://${path.join(__dirname, "out/index.html")}`;
  mainWindow.loadURL(url).catch((err) => {
    console.error("[FikrPad] Failed to load URL:", err);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  mcpServer = startMcpServer(mainWindow);

  // Start loading the embedding model in the background immediately.
  // It resolves into `pipelineReady` so all tools can await it without blocking startup.
  loadEmbeddingModel().then(() => {
    // Once the model is ready, embed any notes that were saved before the model loaded
    runEmbedQueue().catch(console.error);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (mcpServer) mcpServer.close();
});
