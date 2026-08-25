# ADR 010 — Messenger Notes ingestion

## Context

The desktop previously called its incoming note consumer "External Relay",
matching obsolete `fikr.one` routes. A first Messenger cutover retained that
desktop polling model under new names, which meant notes could not be created
while Fikr Studio was closed.

## Decision

Remove the desktop Messenger inbox consumer entirely. `fikr.one` validates a
Messenger delivery and writes the note directly to the Studio Firestore
database. Fikr Studio receives the resulting `studio_notes` document through
its existing authenticated workspace synchronization. ADR 009 is superseded.

## Consequences

The desktop no longer calls `/api/relay/v1/*` or
`/api/integrations/messenger/messages/*`, and it has no Messenger lease,
acknowledgement, retry, or polling state. Existing legacy metadata is
intentionally not consulted in this new implementation.

## Status

Accepted — 2026-08-09
