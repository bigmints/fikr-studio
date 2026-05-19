# ADR 004 — SSO via fikr.one Deep Link Auth

**Date:** 2026-01-01
**Status:** Accepted
**Scope:** `fikr-studio/` Electron app

---

## Context

Fikr Studio is a desktop Electron app. It needs to authenticate users against Firebase without embedding a login form, and without exposing the Firebase Web SDK in the main process. The auth experience must be seamless and use the same identity as all other Fikr apps.

All Fikr apps share the same SSO — implemented by `fikr.one`. No standalone auth is permitted.

---

## Decision

Authentication uses a **browser-based SSO flow with deep link callback**:

1. User clicks "Login" in Fikr Studio
2. Electron opens the system browser: `https://fikr.one/api/auth/desktop`
3. User signs in via Firebase (Google, email, etc.) on `fikr.one`
4. `fikr.one` generates a Firebase custom token and redirects to: `fikr-studio://auth?token=<customToken>`
5. Electron intercepts the `fikr-studio://` deep link protocol
6. Main process fires the `auth-token` IPC event with the token
7. Renderer signs in via Firebase Auth SDK: `signInWithCustomToken(auth, token)`

**Key rule:** No standalone auth is ever implemented in Studio. Auth always flows through `fikr.one`.

---

## Consequences

**Positive:**
- Single identity across all Fikr apps (Studio, Flutter app, web)
- No Firebase credentials or service accounts needed in the desktop app
- Browser handles the full auth UI — Studio code stays thin
- Deep link callback is secure — token is short-lived and single-use

**Negative:**
- Auth requires the system browser to open — can feel jarring on first use
- Deep link registration (`fikr-studio://`) must be declared in `Info.plist` (macOS) and Windows registry
- If `fikr.one` is down, auth is unavailable (offline login requires cached token)

**Rule:** `signInWithCustomToken` is the only permitted Firebase Auth call in Studio. Direct email/password or Google sign-in from within Electron is not allowed.
