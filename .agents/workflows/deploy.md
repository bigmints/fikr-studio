---
description: Build, sign, notarize, and publish Fikr Studio (Electron) OTA to GitHub
---

# Fikr Studio — Deploy Workflow

Builds, signs, notarizes, and uploads the Electron app as a draft OTA release.

> **Before releasing:** complete every gate in `.agents/workflows/release.md`.
> Publishing is the last step, not the first signed build.

## 1. Build, Sign, Notarize & Upload Draft

Run from this project root. `electron-builder` uses the certificates in your
Keychain, invokes `notarytool`, and uploads a draft GitHub release. Publish only
after verifying the downloaded draft artifacts.

```bash
APPLE_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db" \
APPLE_KEYCHAIN_PROFILE="notarytool-profile" \
APPLE_TEAM_ID="FBG8NKYPUJ" \
GH_TOKEN="<fresh-release-token>" \
npx electron-builder build --mac -p always
```

You will be prompted by macOS Keychain to authorize `codesign` — click **Always Allow**.

## 2. Output

The signed app is under `dist/mac-arm64/`; DMG, ZIP, blockmaps, and update
metadata are under `dist/`.

```
dist/mac-arm64/Fikr Studio.app
dist/Fikr Studio-<version>-arm64.dmg
```

## See Also

- Full sign/notarize reference: `.agents/workflows/build-macos.md`
- Manage AI model presets: `.agents/workflows/manage-ai-config.md`
