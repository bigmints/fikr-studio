---
description: Publish a verified Fikr Studio macOS OTA release
---

# Fikr Studio — macOS deploy

`scripts/deploy.sh` is the only release implementation. Both a developer Mac and
`.github/workflows/release-macos.yml` call it; do not reproduce signing or
publishing commands elsewhere.

## Required source state

- `package.json` and `package-lock.json` contain the release version.
- The worktree is completely clean.
- `v<version>` points to `HEAD` locally and on `origin`.
- No GitHub release already exists for the tag.

## Credentials

Local releases use the Developer ID identity and `notarytool-profile` documented
in `release.md`, plus an authenticated `gh` session or `GH_TOKEN`. CI imports the
same Developer ID certificate and supplies App Store Connect API credentials
from repository secrets.

## Run

```bash
npm run deploy
```

The script builds once, signs and notarizes the final artifacts, uploads a draft,
downloads all six assets, verifies the returned DMG and OTA ZIP applications,
metadata, and checksum manifest, and only then publishes. Any failure after the
upload leaves the release as a draft for inspection.

For a signed/notarized candidate without GitHub publication:

```bash
npm run release:verify
```
