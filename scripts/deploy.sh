#!/bin/bash

# Fikr Studio Automated Deployment Script
# This script loads the GitHub token from .env.local and executes the production build,
# code signing, notarization, and GitHub OTA release publishing workflow.

# 1. Load environment variables from .env.local if present
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# 2. Ensure GH_TOKEN is available
if [ -z "$GH_TOKEN" ]; then
  echo "Error: GH_TOKEN is not set. Please add GH_TOKEN=... to your .env.local file."
  exit 1
fi

echo "🚀 Starting Fikr Studio macOS Build, Sign, Notarize & Publish..."
echo "Using Team ID: FBG8NKYPUJ"
echo "Using Keychain Profile: notarytool-profile"

# 3. Execute the build and release process
APPLE_KEYCHAIN_PROFILE="notarytool-profile" \
APPLE_TEAM_ID="FBG8NKYPUJ" \
npm run electron:build -- -p always
