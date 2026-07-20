# User Story: Manual "Check for Updates" Option

## Description
As a user of Fikr Studio,
I want to manually check for application updates from the application menu,
So that I can ensure I have the latest features and bug fixes without waiting for the automatic background check or restarting the application.

## Expected Behavior
- A "Check for Updates..." option is accessible from the native Application menu (e.g., under the "Fikr Studio" menu on macOS, right below "About Fikr Studio").
- When a user clicks this option, the application pings the update server to see if a newer version exists.
- If a new version is available, the app continues with its standard flow (downloading the update and eventually showing the "Update Ready" prompt).
- If the app is already up to date, a small dialog appears informing the user that they are running the latest version.

## Acceptance Criteria
- [ ] A "Check for Updates..." option is present in the application's native menu.
- [ ] Clicking the option triggers an update check using `electron-updater`.
- [ ] If the app is already up to date, a prompt (e.g., "Fikr Studio is up to date") is shown to the user.
- [ ] The automatic background check on startup (`autoUpdater.checkForUpdatesAndNotify()`) continues to function silently and does *not* show the "up to date" dialog.
- [ ] If an update is available, the existing download and installation prompt flow takes over correctly.

## Implementation Details (Fix Strategy)
In `main.js`, add the new menu item and configure `electron-updater` to handle manual checks:

1. **State Flag:** Introduce a variable to track if an update check was user-initiated (to prevent the background check from popping up the "Up to date" dialog).
   ```javascript
   let isManualUpdateCheck = false;
   ```

2. **Native Menu Update:** Add the "Check for Updates..." item to the macOS native menu template (right under `{ role: 'about' }`):
   ```javascript
   {
     label: 'Check for Updates...',
     click: () => {
       isManualUpdateCheck = true;
       autoUpdater.checkForUpdates();
     }
   }
   ```

3. **Handle "No Update":** Listen for the `update-not-available` event to inform the user, but only if they manually requested the check:
   ```javascript
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
   ```

4. **Handle "Update Available":** Reset the flag when an update is found so the state remains clean.
   ```javascript
   autoUpdater.on("update-available", () => {
     isManualUpdateCheck = false;
     console.log("[Fikr Studio] Update available.");
     // Optional: You could also show a dialog here saying "Downloading update..."
   });
   ```
