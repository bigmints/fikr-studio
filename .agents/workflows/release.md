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

> **Before building:** bump `version` in `package.json` (e.g. `0.1.5` → `0.1.6`).

## Build, Sign, Notarize & Publish OTA

`electron-builder` signs, notarizes via `notarytool`, and publishes to GitHub for OTA auto-updates:

```bash
APPLE_KEYCHAIN_PROFILE="notarytool-profile" APPLE_TEAM_ID="FBG8NKYPUJ" GH_TOKEN="<your-github-pat>" npm run electron:build -- -p always
```

You will be prompted by macOS Keychain to authorize `codesign` — click **Always Allow** (or run the one-time setup above).

## Output

```
dist/mac-arm64/
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
