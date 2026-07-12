# ADR-011 — Safe Storage Release Identity

**Status:** accepted
**Date:** 2026-07-12
**Author:** developer

---

## Context

Electron derives the macOS Keychain item used by `safeStorage` from the application name and protects it with the creating application's signing identity. Development and packaged builds inherited the same default `fikr-studio Safe Storage` service name. When the signed app tried to decrypt a startup MCP token previously created by development Electron, macOS asked the user for the login Keychain password because the old item's application requirement did not trust the new signature.

The MCP token is disposable local bearer material and is already exposed while Studio runs through a permission-restricted `mcp-port.json` connection file. BYOK credentials remain long-lived secrets that belong in Keychain-backed storage.

---

## Decision

Signed production and development builds use distinct, explicit Electron application names for their Safe Storage Keychain services while retaining the historical user-data directory. Production and development also use different versioned AI-key ciphertext files, so neither attempts to decrypt data created under the legacy unsigned identity.

The disposable MCP bearer token is stored independently in an atomic, mode-`0600` local JSON file. Invalid or legacy token state is rotated without accessing Keychain.

**Alternatives considered:**
- Ask upgrading users to click “Always Allow” — rejected because a normal application launch must not request the user's macOS login password.
- Delete the legacy Keychain item — rejected because deletion may itself require authorization and destroys the only key capable of decrypting legacy ciphertext.
- Keep the MCP token in Safe Storage but load it lazily — rejected because local MCP clients require the token whenever Studio starts and the token does not need long-lived credential semantics.

---

## Consequences

**Positive:**
- Studio startup does not access a Keychain item created by an unsigned or development build.
- Development can no longer contaminate the signed production Keychain namespace.
- BYOK credentials remain encrypted through macOS Keychain under a stable signed identity.

**Trade-offs / New constraints:**
- A credential saved by a pre-0.1.16 development build must be entered again inside Studio.
- The MCP token file and user-data directory must retain owner-only permissions.
- The explicit Safe Storage application names and versioned ciphertext filenames are compatibility identifiers and must not change casually.

---

## Implementation Notes

**Files affected:**
- `main.js`
- `lib/local-mcp-auth.js`
- `lib/secure-storage-profile.js`
- `tests/local-mcp-auth.test.js`
- `tests/secure-storage-profile.test.js`

---

## References

- Related ADR: `003-mcp-two-tier-architecture.md`
