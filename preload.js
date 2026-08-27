const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes a safe `window.fikrStudio` API to the React renderer.
 * All IPC calls go through this bridge — the renderer never touches
 * Node.js APIs directly (contextIsolation: true is enforced).
 */
contextBridge.exposeInMainWorld("fikrStudio", {
  /** Load all projects from ~/.fikr-studio/workspace.json */
  loadProjects: () => ipcRenderer.invoke("fikr-studio:load-projects"),

  /** Persist all projects to ~/.fikr-studio/workspace.json */
  saveProjects: (data) => ipcRenderer.invoke("fikr-studio:save-projects", data),

  /**
   * Persist the full combined workspace (projects + studioProjects).
   * Used when both note projects and Studio generation projects need saving together.
   */
  saveWorkspace: (data) => ipcRenderer.invoke("fikr-studio:save-projects", data),

  /** Load persisted intro-seen flag */
  getIntroSeen: () => ipcRenderer.invoke("fikr-studio:get-intro-seen"),

  /** Persist intro-seen flag */
  setIntroSeen: () => ipcRenderer.invoke("fikr-studio:set-intro-seen"),

  /** Store BYOK credentials using Electron safeStorage (macOS Keychain-backed). */
  hasSecureAiKey: (provider) => ipcRenderer.invoke("fikr-studio:secure-has-ai-key", provider),
  setSecureAiKey: (provider, apiKey) => ipcRenderer.invoke("fikr-studio:secure-set-ai-key", provider, apiKey),
  verifyAndSetAiKey: (provider, apiKey) => ipcRenderer.invoke("fikr-studio:verify-and-set-ai-key", provider, apiKey),
  requestAi: (provider, body) => ipcRenderer.invoke("fikr-studio:request-ai", { provider, body }),

  /** Run and cancel bounded Fikr agent workflows in the trusted main process. */
  runAgent: (request) => ipcRenderer.invoke("fikr-studio:run-agent", request),
  cancelAgent: (runId) => ipcRenderer.invoke("fikr-studio:cancel-agent", runId),
  respondAgentApproval: (runId, approvalId, approved) => ipcRenderer.invoke("fikr-studio:respond-agent-approval", runId, approvalId, approved),
  onAgentEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fikr-studio:agent-event", handler);
    return () => ipcRenderer.removeListener("fikr-studio:agent-event", handler);
  },
  getAgentMcpConnections: () => ipcRenderer.invoke("fikr-studio:get-agent-mcp-connections"),
  discoverAgentMcpTools: (connection) => ipcRenderer.invoke("fikr-studio:discover-agent-mcp-tools", connection),
  saveAgentMcpConnection: (connection) => ipcRenderer.invoke("fikr-studio:save-agent-mcp-connection", connection),
  setAgentMcpConnectionEnabled: (name, enabled) => ipcRenderer.invoke("fikr-studio:set-agent-mcp-connection-enabled", name, enabled),
  removeAgentMcpConnection: (name) => ipcRenderer.invoke("fikr-studio:remove-agent-mcp-connection", name),

  /** Write plain text through Electron when renderer clipboard permission is unavailable. */
  writeClipboardText: (text) => ipcRenderer.invoke("fikr-studio:clipboard-write-text", text),

  /** Save a bounded text export through Electron without navigating the renderer. */
  saveTextFile: (filename, content) => ipcRenderer.invoke("fikr-studio:save-text-file", { filename, content }),
  saveBase64File: (filename, base64) => ipcRenderer.invoke("fikr-studio:save-base64-file", { filename, base64 }),

  /**
   * Register a callback for events pushed from the MCP server.
   * The callback receives { type, payload } objects.
   * Returns a cleanup function that removes the listener.
   */
  onExternalEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fikr-studio:external-event", handler);
    return () => ipcRenderer.removeListener("fikr-studio:external-event", handler);
  },

  /** Receive startup progress events from the main process (used by splash screen) */
  onSplashProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fikr-studio:splash-progress", handler);
    return () => ipcRenderer.removeListener("fikr-studio:splash-progress", handler);
  },

  /** Receive the short-lived manual update-check loading state. */
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fikr-studio:update-status", handler);
    return () => ipcRenderer.removeListener("fikr-studio:update-status", handler);
  },


  /** Get the MCP server port (for displaying in Settings) */
  getMcpPort: () => ipcRenderer.invoke("fikr-studio:get-mcp-port"),
  getMcpConnection: () => ipcRenderer.invoke("fikr-studio:get-mcp-connection"),
  /** Return the server-verified account profile and plan. */
  getAccount: () => ipcRenderer.invoke("fikr-studio:get-account"),
  rotateRelayKey: () => ipcRenderer.invoke("fikr-studio:rotate-relay-key"),

  /** Execute a tool directly from the React renderer (e.g. from Cloud Relay) */
  executeTool: (name, args) => ipcRenderer.invoke("fikr-studio:execute-tool", { name, args }),

  /** Execute a raw MCP payload directly */
  executeMcp: (rpc) => ipcRenderer.invoke("fikr-studio:execute-mcp", rpc),

  /** Open Fikr.One SSO login in browser */
  openAuth: () => ipcRenderer.invoke("fikr-studio:open-auth"),

  /** 1-Click MCP Installations */
  checkMcp: (client) => ipcRenderer.invoke("fikr-studio:check-mcp", client),
  installMcp: (client) => ipcRenderer.invoke("fikr-studio:install-mcp", client),
  uninstallMcp: (client) => ipcRenderer.invoke("fikr-studio:uninstall-mcp", client),
  /** Live connectivity test: resolves { ok, status?, error? } */
  testMcp: (client) => ipcRenderer.invoke("fikr-studio:test-mcp", client),

  /** Open a URL in the system default browser (not Electron) */
  openUrl: (url) => ipcRenderer.invoke("fikr-studio:open-url", url),

  /**
   * Notify the main process of the current Firebase Auth user.
   * Must be called on every auth state change (sign-in and sign-out).
   * @param {string|null} uid      - Firebase UID, or null if signed out
   * @param {string|null} idToken  - Firebase ID token (for fikr.one API calls)
   */
  setUser: (uid, idToken) => ipcRenderer.invoke("fikr-studio:set-user", { uid, idToken }),

  /** Proxy fetch for usage API to bypass renderer CORS */
  getUsage: () => ipcRenderer.invoke("fikr-studio:get-usage"),

  /**
   * Full logout flow — syncs data to cloud, shows a native keep/clear dialog,
   * and optionally wipes the local workspace cache.
   * @param {object|null} currentData - The current { projects, activeProjectId } payload to sync
   * @returns {Promise<{ cleared: boolean, cancelled: boolean }>}
   */
  logout: (currentData) => ipcRenderer.invoke("fikr-studio:logout", { currentData }),

  /** Manually pull from the cloud and sync workspace to disk */
  syncWorkspace: () => ipcRenderer.invoke("fikr-studio:sync-workspace"),
});
