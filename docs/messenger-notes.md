# Local MCP and remote Messenger notes

Fikr has two different ways for agents to connect. They solve different
problems.

| What you need | Use | Plan | Must Fikr Studio be open? |
|---|---|---|---|
| Read, search, create, edit, delete, or use canvas tools from an AI client on this computer | Local MCP | Free | Yes |
| Add a note from a remote agent, server, webhook, or scheduled job | SaveADay Messenger | Plus or Pro | No |

## For people

### Connect an AI client on this computer

1. Open Fikr Studio.
2. Open **Connections** from the main navigation.
3. Choose your AI client.
4. Follow the install or copy steps shown there.
5. Keep Fikr Studio open while the AI client uses Fikr tools.

This is the free local MCP connection. It does not send your local MCP endpoint
over the internet.

### Let a remote agent or service add notes

1. Open [Fikr Settings](https://www.fikr.one/dashboard/settings).
2. Find **Messenger Hooks**.
3. Name the agent or service.
4. Choose the Fikr Studio project that should receive its notes.
5. Select **Create hook**.
6. Select **Copy instructions for agent**.
7. Give the copied text to the trusted agent or service.
8. Ask it to send a test note. The hook's **Last delivery** time changes when
   Fikr receives it.

The copied text contains secrets. Do not post it publicly, save it in source
control, or put it in browser, mobile, or Electron code.

The hook is already tied to your Fikr account and chosen project. The sender
does not need your Fikr user ID or project ID. Fikr Studio can be closed when
the note arrives; normal cloud sync shows it when Studio opens.

## For agents and services

### Local work

If you run on the same computer as Fikr Studio and need interactive tools, use
the local MCP configuration shown in **Fikr → Connections**.
Fikr Studio must be open. Never publish or tunnel the local MCP endpoint to the
internet.

### Remote note delivery

Ask the user for the full text produced by **Copy instructions for agent** in
Fikr Settings. Treat its URL, source key, and signing secret as server-only
secrets. Follow its exact body, header, HMAC, idempotency, and retry rules.

Do not ask for or send:

- a Relay API Key;
- a Fikr user ID or project ID;
- a Firebase credential;
- a Firestore or database credential; or
- a Fikr provider endpoint or endpoint token.

Each accepted request returns a stable Messenger reference. HTTP `202` means
Messenger accepted the note for queued delivery; it is not final delivery
proof. Keep and report the reference. The user can confirm delivery through
the hook's **Last delivery** time or the selected Fikr Studio project.

Messenger is a one-way remote note inbox. It does not support remote reads,
searches, edits, deletes, or canvas tools.
