# ADR 014: Fail-closed macOS release delivery

## Status

Accepted — 2026-08-06

## Context

Fikr Studio previously had separate local documentation, a local deploy script,
and a GitHub Actions implementation for macOS releases. Those paths could drift.
They also published before independently verifying the assets returned by GitHub,
and the updater metadata used dotted asset names while the CLI upload retained
spaces. A notarized local build was therefore not sufficient evidence that the
published OTA update was installable.

## Decision

`scripts/deploy.sh` is the single macOS release implementation used locally and
by GitHub Actions. It requires clean, tagged source; runs the production gates;
builds and Developer-ID signs the app; signs, notarizes, and staples the final
DMG; regenerates updater metadata from the final bits; and verifies the app in
the build directory, DMG, and OTA ZIP.

Publishing is fail-closed. The script uploads dotted, updater-compatible asset
names to a draft release, downloads the complete draft asset set to a new
temporary directory, verifies signatures, notarization tickets, app contents,
metadata hashes and sizes, and SHA-256 checksums, and only then makes the release
public. A failed post-upload check leaves a recoverable draft and never promotes
it.

## Consequences

- Local and CI releases execute the same implementation and gates.
- A release requires a clean commit and an exact tag already pushed to origin.
- GitHub Actions remains optional until its Apple secrets are configured; the
  local Keychain and notary profile can run the identical pipeline immediately.
- Release artifacts use stable dotted names that match `latest-mac.yml`.
- Publishing takes longer because every uploaded binary is downloaded and
  verified, but a public release can no longer bypass that proof.
