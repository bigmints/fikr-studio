#!/usr/bin/env bash
set -euo pipefail

# Build a signed and notarized release candidate, prove the exact DMG and ZIP,
# then publish a draft OTA release. Credentials must already be in the current
# shell or macOS Keychain; this script never reads them from project files.

if [[ -z "${GH_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  GH_TOKEN="$(gh auth token 2>/dev/null || true)"
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN must be exported before publishing a draft release." >&2
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -q 'Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)'; then
  echo "Required Developer ID Application signing identity is unavailable." >&2
  exit 1
fi

if ! xcrun notarytool history --keychain-profile notarytool-profile >/dev/null 2>&1; then
  echo "notarytool-profile is unavailable or cannot be used." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
APP="dist/mac-arm64/Fikr Studio.app"
DMG="dist/Fikr Studio-${VERSION}-arm64.dmg"
ZIP="dist/Fikr Studio-${VERSION}-arm64-mac.zip"

echo "Building signed and notarized Fikr Studio ${VERSION} release candidate..."
npm run verify
APPLE_KEYCHAIN_PROFILE="notarytool-profile" \
APPLE_TEAM_ID="FBG8NKYPUJ" \
npx electron-builder build --mac -p never

echo "Signing and notarizing the final DMG..."
codesign --force \
  --sign "Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)" \
  --timestamp "$DMG"
xcrun notarytool submit "$DMG" \
  --keychain-profile "notarytool-profile" \
  --wait
xcrun stapler staple "$DMG"
node scripts/refresh-mac-update-metadata.mjs

node scripts/verify-macos-release.mjs "$APP" "$DMG" "$ZIP"

echo "Publishing a draft GitHub release for ${VERSION}..."
ASSETS=(
  "$DMG"
  "${DMG}.blockmap"
  "$ZIP"
  "${ZIP}.blockmap"
  dist/latest-mac.yml
)

if GH_TOKEN="$GH_TOKEN" gh release view "v${VERSION}" >/dev/null 2>&1; then
  GH_TOKEN="$GH_TOKEN" gh release upload "v${VERSION}" --clobber "${ASSETS[@]}"
else
  GH_TOKEN="$GH_TOKEN" gh release create "v${VERSION}" \
    --draft \
    --title "Fikr Studio ${VERSION}" \
    "${ASSETS[@]}"
fi
