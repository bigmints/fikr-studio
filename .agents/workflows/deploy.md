---
description: Build, sign, notarize, and publish Fikr Studio (Electron) OTA to GitHub
---

# Fikr Studio — Deploy Workflow

Builds, signs, notarizes, and publishes the Electron app as an OTA release to GitHub.

> **Before releasing:** bump `version` in `package.json` (e.g. `0.1.5` → `0.1.6`). The DMG filename and OTA update channel key off this value. Then test thoroughly via `npm run dev`.

## 1. Build, Sign, Notarize & Publish OTA

Run from this project root. `electron-builder` uses the certificates in your Keychain to sign the app, invokes `notarytool` automatically, and publishes to GitHub for OTA auto-updates.

```bash
APPLE_KEYCHAIN_PROFILE="notarytool-profile" APPLE_TEAM_ID="FBG8NKYPUJ" GH_TOKEN="<your-github-pat>" npm run electron:build -- -p always
```

You will be prompted by macOS Keychain to authorize `codesign` — click **Always Allow**.

## 2. Output

The signed and notarized `.dmg` and `.app` files are in:
```
dist/mac-arm64/
```

## See Also

- Full sign/notarize reference: `.agents/workflows/build-macos.md`
- Manage AI model presets: `.agents/workflows/manage-ai-config.md`
