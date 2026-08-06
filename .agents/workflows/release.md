---
description: Prerequisites and guarantees for the canonical Fikr Studio macOS release
---

# Fikr Studio — macOS release

## Local prerequisites

- Apple Team ID: `FBG8NKYPUJ`
- Developer ID identity: `Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)`
- Signing SHA: `6C1A3F8220D266BD1EE7F74CA9DDE320610F911D`
- Notary credentials in Keychain profile `notarytool-profile`
- Authenticated GitHub CLI session or `GH_TOKEN`

Verify Apple access without exposing credentials:

```bash
security find-identity -v -p codesigning
xcrun notarytool history --keychain-profile notarytool-profile
```

## Canonical commands

```bash
# Signed/notarized candidate, with every local artifact gate
npm run release:verify

# Draft upload, redownload verification, then publication
npm run deploy
```

Both commands execute `scripts/deploy.sh`. GitHub Actions also executes
`npm run deploy`; it is not a second implementation.

## Enforced guarantees

The release script requires clean tagged source and verifies:

- lint, typecheck, tests, source/history secret scans, dependency audit, and build;
- Developer ID Team ID, hardened runtime, production entitlements, strict deep
  signatures, Gatekeeper acceptance, and stapled notarization tickets;
- the built app, app mounted from DMG, and app extracted from OTA ZIP;
- package metadata, URL scheme, app size, `app.asar` contents, and forbidden files;
- dotted GitHub asset names matching `latest-mac.yml`;
- updater sha512 values and sizes plus SHA-256 checksums for every uploaded asset;
- the exact complete asset set after downloading the GitHub draft.

The public release is created only after the downloaded draft passes. Failure
leaves a draft; it does not publish partially verified binaries.
