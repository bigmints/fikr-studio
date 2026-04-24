const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes a safe `window.fikrpad` API to the React renderer.
 * All IPC calls go through this bridge — the renderer never touches
 * Node.js APIs directly (contextIsolation: true is enforced).
 */
contextBridge.exposeInMainWorld("fikrpad", {
  /** Load all projects from ~/.fikrpad/workspace.json */
  loadProjects: () => ipcRenderer.invoke("fikrpad:load-projects"),

  /** Persist all projects to ~/.fikrpad/workspace.json */
  saveProjects: (data) => ipcRenderer.invoke("fikrpad:save-projects", data),

  /** Load persisted intro-seen flag */
  getIntroSeen: () => ipcRenderer.invoke("fikrpad:get-intro-seen"),

  /** Persist intro-seen flag */
  setIntroSeen: () => ipcRenderer.invoke("fikrpad:set-intro-seen"),

  /**
   * Register a callback for events pushed from the MCP server.
   * The callback receives { type, payload } objects.
   * Returns a cleanup function that removes the listener.
   */
  onExternalEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fikrpad:external-event", handler);
    return () => ipcRenderer.removeListener("fikrpad:external-event", handler);
  },

  /** Get the MCP server port (for displaying in Settings) */
  getMcpPort: () => ipcRenderer.invoke("fikrpad:get-mcp-port"),
});
