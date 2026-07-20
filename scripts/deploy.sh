#!/usr/bin/env bash
set -euo pipefail

# Build a signed and notarized release candidate, prove the exact DMG and ZIP,
# then publish an OTA release. Credentials must already be in the current
# shell or macOS Keychain; this script never reads them from project files.

if [[ -z "${GH_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  GH_TOKEN="$(gh auth token 2>/dev/null || true)"
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN must be exported before publishing a release." >&2
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
npm run build
APPLE_KEYCHAIN_PROFILE="notarytool-profile" \
APPLE_TEAM_ID="FBG8NKYPUJ" \
npx electron-builder build --mac -p never

# A signed app can still open to a blank screen if the static renderer was not
# packaged. Fail before notarizing or publishing unless the exact app bundle
# contains the exported renderer and required runtime files.
node scripts/check-macos-package.mjs "$APP"
npm run check:asar

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

echo "Publishing GitHub release for ${VERSION}..."
REPO="bigmints/fikr-studio"
PUBLISH_DMG="dist/Fikr.Studio-${VERSION}-arm64.dmg"
PUBLISH_DMG_BLOCKMAP="${PUBLISH_DMG}.blockmap"
PUBLISH_ZIP="dist/Fikr.Studio-${VERSION}-arm64-mac.zip"
PUBLISH_ZIP_BLOCKMAP="${PUBLISH_ZIP}.blockmap"

# latest-mac.yml uses GitHub's dot-normalized asset names. Upload files with
# those exact names so automatic updates resolve the published URLs.
ln -f "$DMG" "$PUBLISH_DMG"
ln -f "${DMG}.blockmap" "$PUBLISH_DMG_BLOCKMAP"
ln -f "$ZIP" "$PUBLISH_ZIP"
ln -f "${ZIP}.blockmap" "$PUBLISH_ZIP_BLOCKMAP"

ASSETS=(
  "$PUBLISH_DMG"
  "$PUBLISH_DMG_BLOCKMAP"
  "$PUBLISH_ZIP"
  "$PUBLISH_ZIP_BLOCKMAP"
  dist/latest-mac.yml
)

if GH_TOKEN="$GH_TOKEN" gh release view "v${VERSION}" --repo "$REPO" >/dev/null 2>&1; then
  GH_TOKEN="$GH_TOKEN" gh release upload "v${VERSION}" --repo "$REPO" --clobber "${ASSETS[@]}"
else
  GH_TOKEN="$GH_TOKEN" gh release create "v${VERSION}" \
    --repo "$REPO" \
    --title "Fikr Studio ${VERSION}" \
    "${ASSETS[@]}"
fi
