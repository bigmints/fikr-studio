---
description: Build, sign, notarize, and publish Fikr Studio (Electron) DMG for macOS
---

# Fikr Studio — macOS Build, Sign & Notarize

Produces a notarized DMG distributed to any Mac without "unidentified developer" warnings.

## Prerequisites

- **Apple Developer Program** (Team ID: `FBG8NKYPUJ`)
- **Developer ID Application** cert in Keychain
  - Identity: `Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)`
  - SHA: `6C1A3F8220D266BD1EE7F74CA9DDE320610F911D`
- **Notarytool credentials** in Keychain profile `notarytool-profile`
  - Apple ID: `me@bigmints.com` · Team ID: `FBG8NKYPUJ`

If credentials are not stored:
```bash
xcrun notarytool store-credentials "notarytool-profile" \
  --apple-id "me@bigmints.com" \
  --password "APP_SPECIFIC_PASSWORD" \
  --team-id "FBG8NKYPUJ"
```

### One-time headless codesign setup

Run once on the machine to eliminate all future Keychain prompts:
```bash
security set-key-partition-list \
  -S "apple-tool:,apple:,codesign:" \
  -s -k "YOUR_LOGIN_PASSWORD" \
  -D "Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)" \
  -t private \
  ~/Library/Keychains/login.keychain-db
```

---

> **Before building:** bump `version` in `package.json` and update the lockfile.

## 1. Verify the source

```bash
npm ci
npm run verify
```

## 2. Build, sign, and notarize a release candidate

Do not publish from this step. `APPLE_KEYCHAIN_PROFILE` activates
electron-builder's notarytool integration. Do not set `APPLE_KEYCHAIN` unless
the profile was explicitly stored in that exact keychain.

```bash
APPLE_KEYCHAIN_PROFILE="notarytool-profile" \
APPLE_TEAM_ID="FBG8NKYPUJ" \
npm run electron:build
```

You will be prompted by macOS Keychain to authorize `codesign` — click **Always Allow** (or run the one-time setup above).

## 3. Verify the exact artifacts

Replace the version in the DMG filename with the release candidate version.

```bash
node scripts/verify-macos-release.mjs \
  "dist/mac-arm64/Fikr Studio.app" \
  "dist/Fikr Studio-<version>-arm64.dmg" \
  "dist/Fikr Studio-<version>-arm64-mac.zip"
npm run check:asar
```

The verifier requires strict code-sign validation, Gatekeeper acceptance,
stapled notarization tickets on both the app and DMG, and no unused privacy or
ATS declarations.

## 4. Upload a draft only after runtime acceptance

After install, update, rollback, data-preservation, MCP-auth, BYOK migration,
and unlocked desktop UI checks pass:

```bash
GH_TOKEN="<fresh-release-token>" npx electron-builder build --mac -p always
```

The GitHub publisher is configured with `releaseType: draft`. Verify the draft
asset checksums and repeat the signature, notarization, install, update, and
data-preservation checks against the downloaded assets before publishing the
release in GitHub.

## Output

```text
dist/mac-arm64/Fikr Studio.app
dist/Fikr Studio-<version>-arm64.dmg
```

## Troubleshooting

### Certificate not found
```bash
security find-identity -v -p codesigning
```

### Notarization rejected
```bash
xcrun notarytool log <SUBMISSION_ID> --keychain-profile "notarytool-profile"
```

### App-specific password
Generate at: https://appleid.apple.com → Sign-in and Security → App-Specific Passwords

### CSR generation fails in Keychain Access
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout /tmp/devid_private.key \
  -out /tmp/CertificateSigningRequest.certSigningRequest \
  -subj "/emailAddress=me@bigmints.com/CN=Pretheesh Thomas/C=AE"
```
Then upload at https://developer.apple.com/account/resources/certificates/add → Developer ID Application.
