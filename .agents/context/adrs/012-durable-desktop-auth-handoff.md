# ADR-012 — Durable Desktop Auth Handoff

**Status:** accepted
**Date:** 2026-07-12
**Author:** developer

---

## Context

The fikr.one token exchange successfully redirected to `fikr-studio://`, but Studio forwarded the custom token as a transient generic renderer event. If the callback arrived before React listeners mounted, the token was lost. Multiple components also attempted `signInWithCustomToken` independently and one swallowed failures, leaving the packaged app signed out without an actionable error.

---

## Decision

Electron main retains one pending custom token in memory and exposes a dedicated renderer handshake. The top-level renderer auth coordinator may read the pending token after startup, receives live token events, and acknowledges the token only after Firebase custom-token sign-in succeeds.

Component-level token consumers are removed. A failed sign-in retains the pending token and exposes a visible Retry action.

**Alternatives considered:**
- Keep the generic renderer event and add more listeners — rejected because event delivery remains timing-dependent and duplicates token consumption.
- Persist the custom token to disk — rejected because the handoff only needs to survive renderer startup, not application termination, and disk persistence increases credential exposure.
- Clear the token immediately after event delivery — rejected because delivery does not prove Firebase accepted it.

---

## Consequences

**Positive:**
- Callback delivery is not lost while the renderer loads.
- Exactly one renderer coordinator performs custom-token sign-in.
- Firebase failures are visible and retryable.

**Trade-offs / New constraints:**
- Electron main holds the pending token until explicit renderer acknowledgement or a new login attempt.
- Any future authentication UI must use the top-level coordinator instead of consuming callback events directly.

---

## Implementation Notes

**Files affected:**
- `main.js`
- `preload.js`
- `app/page.tsx`
- `components/project-sidebar.tsx`
- `components/intro-modal.tsx`

---

## References

- Related ADR: `004-sso-deeplink-auth.md`
- Related ADR: `010-development-sso-loopback-callback.md`
