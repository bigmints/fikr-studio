#!/usr/bin/env bash
set -euo pipefail

# Canonical fail-closed macOS release path for both a developer Mac and CI.
# It builds one candidate, notarizes the final DMG, uploads a draft, downloads
# every asset again, verifies the downloaded apps/metadata/checksums, and only
# then makes the release public.

MODE="${1:---publish}"
if [[ "$MODE" != "--publish" && "$MODE" != "--build-only" ]]; then
  echo "Usage: $0 [--publish|--build-only]" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Release source must be a completely clean Git worktree." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
HEAD_SHA="$(git rev-parse HEAD)"
IDENTITY="Developer ID Application: Pretheesh Thomas (FBG8NKYPUJ)"
TEAM_ID="${APPLE_TEAM_ID:-FBG8NKYPUJ}"
APP="dist/mac-arm64/Fikr Studio.app"
DMG="dist/Fikr Studio-${VERSION}-arm64.dmg"
ZIP="dist/Fikr Studio-${VERSION}-arm64-mac.zip"
META="dist/latest-mac.yml"
UPLOAD_DIR="dist/release-upload"

if [[ "$(git rev-list -n 1 "$TAG" 2>/dev/null || true)" != "$HEAD_SHA" ]]; then
  echo "$TAG must exist locally and point to HEAD ($HEAD_SHA)." >&2
  exit 1
fi

if [[ "$MODE" == "--publish" ]]; then
  if [[ -z "${GH_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
  fi
  if [[ -z "${GH_TOKEN:-}" ]]; then
    echo "GH_TOKEN or an authenticated gh session is required for publishing." >&2
    exit 1
  fi
  export GH_TOKEN
  REMOTE_TAG_SHA="$(git ls-remote origin "refs/tags/${TAG}" | awk '{print $1}')"
  if [[ "$REMOTE_TAG_SHA" != "$HEAD_SHA" ]]; then
    echo "$TAG must be pushed to origin and point to HEAD before publishing." >&2
    exit 1
  fi
  if gh release view "$TAG" >/dev/null 2>&1; then
    echo "GitHub release $TAG already exists; refusing to overwrite it." >&2
    exit 1
  fi
fi

if ! security find-identity -v -p codesigning | grep -Fq "$IDENTITY"; then
  echo "Required Developer ID Application signing identity is unavailable." >&2
  exit 1
fi

NOTARY_ARGS=()
if [[ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then
  NOTARY_ARGS=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
elif xcrun notarytool history --keychain-profile notarytool-profile >/dev/null 2>&1; then
  APPLE_KEYCHAIN_PROFILE="notarytool-profile"
  export APPLE_KEYCHAIN_PROFILE
  NOTARY_ARGS=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
elif [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  NOTARY_ARGS=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
else
  echo "Provide APPLE_KEYCHAIN_PROFILE or App Store Connect API key credentials for notarization." >&2
  exit 1
fi

export APPLE_TEAM_ID="$TEAM_ID"

echo "Running source gates for Fikr Studio ${VERSION}..."
npm ci
npm run verify

echo "Building, Developer-ID signing, and notarizing the app..."
npm run build
npx electron-builder build --mac -p never

echo "Signing, notarizing, and stapling the final DMG..."
codesign --force --sign "$IDENTITY" --timestamp "$DMG"
xcrun notarytool submit "$DMG" "${NOTARY_ARGS[@]}" --wait
xcrun stapler staple "$DMG"

node scripts/refresh-mac-update-metadata.mjs
node scripts/verify-macos-release.mjs "$APP" "$DMG" "$ZIP"
npm run check:asar

rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"
DMG_ASSET="$(basename "$DMG" | tr ' ' '.')"
ZIP_ASSET="$(basename "$ZIP" | tr ' ' '.')"
cp "$DMG" "$UPLOAD_DIR/$DMG_ASSET"
cp "${DMG}.blockmap" "$UPLOAD_DIR/${DMG_ASSET}.blockmap"
cp "$ZIP" "$UPLOAD_DIR/$ZIP_ASSET"
cp "${ZIP}.blockmap" "$UPLOAD_DIR/${ZIP_ASSET}.blockmap"
cp "$META" "$UPLOAD_DIR/latest-mac.yml"
node scripts/write-release-checksums.mjs "$UPLOAD_DIR/SHA256SUMS.txt" \
  "$UPLOAD_DIR/$DMG_ASSET" \
  "$UPLOAD_DIR/${DMG_ASSET}.blockmap" \
  "$UPLOAD_DIR/$ZIP_ASSET" \
  "$UPLOAD_DIR/${ZIP_ASSET}.blockmap" \
  "$UPLOAD_DIR/latest-mac.yml"
node scripts/verify-release-assets.mjs \
  "$UPLOAD_DIR/latest-mac.yml" \
  "$UPLOAD_DIR/$DMG_ASSET" \
  "$UPLOAD_DIR/$ZIP_ASSET" \
  "$UPLOAD_DIR/SHA256SUMS.txt"

if [[ "$MODE" == "--build-only" ]]; then
  echo "Verified release candidate is ready in $UPLOAD_DIR"
  exit 0
fi

echo "Creating draft GitHub release $TAG..."
gh release create "$TAG" \
  --verify-tag \
  --draft \
  --title "Fikr Studio ${VERSION}" \
  --notes "Verified macOS release of Fikr Studio ${VERSION}." \
  "$UPLOAD_DIR/$DMG_ASSET" \
  "$UPLOAD_DIR/${DMG_ASSET}.blockmap" \
  "$UPLOAD_DIR/$ZIP_ASSET" \
  "$UPLOAD_DIR/${ZIP_ASSET}.blockmap" \
  "$UPLOAD_DIR/latest-mac.yml" \
  "$UPLOAD_DIR/SHA256SUMS.txt"

DOWNLOAD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fikr-release-download.XXXXXX")"
cleanup() { rm -rf "$DOWNLOAD_DIR"; }
trap cleanup EXIT

echo "Downloading and verifying the exact draft assets..."
gh release download "$TAG" --dir "$DOWNLOAD_DIR"
EXPECTED_ASSETS="$(printf '%s\n' \
  "$DMG_ASSET" "${DMG_ASSET}.blockmap" \
  "$ZIP_ASSET" "${ZIP_ASSET}.blockmap" \
  "latest-mac.yml" "SHA256SUMS.txt" | LC_ALL=C sort)"
ACTUAL_ASSETS="$(find "$DOWNLOAD_DIR" -maxdepth 1 -type f -exec basename {} \; | LC_ALL=C sort)"
if [[ "$ACTUAL_ASSETS" != "$EXPECTED_ASSETS" ]]; then
  echo "Downloaded release asset set does not match the expected set." >&2
  diff -u <(printf '%s\n' "$EXPECTED_ASSETS") <(printf '%s\n' "$ACTUAL_ASSETS") || true
  exit 1
fi

node scripts/verify-macos-release.mjs \
  "$APP" \
  "$DOWNLOAD_DIR/$DMG_ASSET" \
  "$DOWNLOAD_DIR/$ZIP_ASSET"
node scripts/verify-release-assets.mjs \
  "$DOWNLOAD_DIR/latest-mac.yml" \
  "$DOWNLOAD_DIR/$DMG_ASSET" \
  "$DOWNLOAD_DIR/$ZIP_ASSET" \
  "$DOWNLOAD_DIR/SHA256SUMS.txt"

echo "Downloaded draft passed every gate; publishing $TAG..."
gh release edit "$TAG" --draft=false --latest
gh release view "$TAG" --json isDraft,isLatest,tagName,url
echo "Fikr Studio ${VERSION} is published and independently verified."
