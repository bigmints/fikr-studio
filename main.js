const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000', // transparent
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the static build instead of localhost since `npm run electron:dev`
  // runs `npm run build` and doesn't start a dev server.
  const url = `file://${path.join(__dirname, "out/index.html")}`;

  win.loadURL(url).catch((err) => {
    console.error("Failed to load URL:", err);
  });

  // Native Apple visual effects (transparent background with vibrancy)
  win.webContents.on('dom-ready', () => {
    // any dom ready logic
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
