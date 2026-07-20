# User Story: Auto Updater Fails to Quit Application Completely

## Description
As a user of Fikr Studio,
When I see the auto-updater popup and click "Quit and Install",
I expect the application to quit completely and restart with the updates,
So that I don't have to manually quit the app to trigger the installation.

## Current Behavior
When the update dialog appears and the user clicks "Quit and Install", the application attempts to quit but fails to close completely. The app remains open or running in the background, requiring the user to manually quit (e.g., from the tray or macOS Dock) before the update is actually applied and the app restarts.

## Expected Behavior
Clicking "Quit and Install" should seamlessly and completely close the application, allowing `electron-updater` to apply the update and relaunch the new version.

## Root Cause Analysis
This is a known issue on macOS with Electron and `electron-updater`, combined with custom window lifecycle logic:
1. **Window Close Interception:** In `main.js`, the `mainWindow` intercepts the `close` event to hide the window instead of closing it, unless the `isQuiting` flag is `true`.
2. **Dialog Event Loop Block:** `autoUpdater.quitAndInstall()` is called synchronously inside the `.then()` handler of `dialog.showMessageBox`. On macOS, the native dialog needs a brief moment to fully dismiss. Calling a quit command while the native dialog is still closing can interrupt the quit sequence.
3. **Flag Timing:** Because the quit sequence is aborted or hangs, `app.quit()` might not fully execute, meaning `isQuiting` is either not set in time or the `close` event prevention blocks it.

## Acceptance Criteria
- [ ] When an update is downloaded, the "Update Ready" dialog appears.
- [ ] Clicking "Quit and Install" correctly and automatically closes the app.
- [ ] The app successfully installs the update and restarts.
- [ ] Clicking "Later" simply dismisses the dialog and the app remains functional.

## Implementation Details (Fix Strategy)
In `main.js` (around line 1870), update the `autoUpdater.on("update-downloaded")` handler:
1. Explicitly set `isQuiting = true` before calling the updater to ensure the `mainWindow.on('close')` event does not prevent the window from closing.
2. Wrap `autoUpdater.quitAndInstall()` in a `setImmediate` or `setTimeout` (e.g., 100ms) to ensure the dialog is fully destroyed and the event loop is cleared before initiating the quit process.

**Proposed Code Change:**
```javascript
  autoUpdater.on("update-downloaded", () => {
    console.log("[Fikr Studio] Update downloaded. Ready to install.");
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "A new version of Fikr Studio has been downloaded. Quit and install now?",
      buttons: ["Quit and Install", "Later"]
    }).then(result => {
      if (result.response === 0) {
        // Explicitly set isQuiting to bypass window close prevention
        isQuiting = true;
        
        // Defer quitAndInstall to allow the dialog to fully dismiss on macOS
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 100);
      }
    });
  });
```
