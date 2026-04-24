const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

// ─── Constants ────────────────────────────────────────────────────────────────
const MCP_PORT = 3025;
const WORKSPACE_DIR = path.join(app.getPath("home"), ".fikrpad");
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.json");
const INTRO_FILE = path.join(WORKSPACE_DIR, "intro-seen");

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
ipcMain.handle("fikrpad:save-projects", (_event, data) => saveProjectsToDisk(data));
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
function executeTool(name, args, mainWindow) {
  const projects = loadProjectsFromDisk() || [];

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
      const query = (args.query || "").toLowerCase();
      const limit = args.limit || 10;
      const searchIn = args.project_id ? [getProject(args.project_id)].filter(Boolean) : projects;
      const results = [];
      for (const proj of searchIn) {
        for (const b of proj.blocks || []) {
          const haystack = `${b.text} ${b.annotation || ""} ${b.category || ""}`.toLowerCase();
          if (haystack.includes(query)) {
            results.push({ project: proj.name, project_id: proj.id, id: b.id, text: b.text, type: b.contentType, annotation: b.annotation });
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
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
      proj.blocks = [...(proj.blocks || []), newNote];
      saveProjectsToDisk(projects);
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
      saveProjectsToDisk(projects);
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
      saveProjectsToDisk(projects);
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
      saveProjectsToDisk(projects);
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
            const result = executeTool(name, args || {}, mainWindow);
            respond(result);
            break;
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
              const projects = loadProjectsFromDisk() || [];
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
