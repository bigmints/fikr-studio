# Fikr Studio

Fikr Studio is a chat-first macOS knowledge workspace for understanding stored
notes, building knowledge, and creating reviewable outputs such as social posts.

This project is based on [Nodepad](https://github.com/mskayyali/nodepad) by
Saleh Kayyali and retains its MIT attribution.

## Supported product

- Local note capture works without an account.
- Electron stores the workspace in `~/.fikr-studio/workspace.json`.
- Projects can be exported to and imported from `.fikrdata` files.
- BYOK enrichment supports OpenRouter, OpenAI, and Google Gemini; credentials
  remain in Electron secure storage and provider requests run in the main process.
- BYOK Chat uses the OpenAI Agents SDK for bounded orchestration while Fikr owns
  skills, tools, knowledge retrieval, citations, security, UI, and provider routing.
- Trusted MCP servers can extend Chat only after Fikr discovers their tools and
  the user explicitly allowlists and saves the tools they want enabled.
- Note content sent for enrichment goes directly to the selected provider.
- Plus and Pro users can opt into cloud synchronization through `fikr.one`.
- The local MCP server requires Fikr Studio to be running.
- Plus and Pro users can receive notes from remote agents and services through
  SaveADay Messenger while Fikr Studio is closed.

Fikr Studio does not currently promise production browser hosting, custom LLM
endpoints, Voice Notes integration, or fully offline generative AI.

Managed Plus/Pro Chat still uses the existing cloud chat endpoint. That endpoint
does not yet expose tool calls, so Agents SDK orchestration currently applies to
BYOK OpenRouter/OpenAI/Gemini and the explicit loopback local-AI development mode.

## Development

Requirements: Node.js 20 or newer and macOS for Electron packaging.

```bash
npm install
npm run electron:dev
```

Validation:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Release builds must follow `.agents/workflows/release.md`. A distributable build
is not considered complete until its signature and notarization ticket have been
verified against the exact published artifact.

## Data and network behavior

| Capability | Local storage | Network use |
|---|---|---|
| Notes and projects | `~/.fikr-studio/workspace.json` | None for local-only use |
| BYOK enrichment | Provider settings on this Mac | Sends selected note context to the configured AI provider |
| Agent Chat | Local threads and artifacts | Sends bounded relevant-note context to the selected BYOK provider; may call explicitly allowlisted MCP tools |
| Plus/Pro sync | Local workspace cache | Sends workspace data to authenticated `fikr.one` sync APIs |
| Local relevance search | In-memory and workspace vectors | None |
| Plus/Pro semantic search | Cloud workspace | Authenticated `fikr.one` request |

## Connecting agents

Choose one connection based on where the agent runs.

| Need | Connection | Plan | Studio open? |
|---|---|---|---|
| An AI client on this Mac needs Fikr tools | Local MCP | Free | Yes |
| A remote agent or service needs to add a note | SaveADay Messenger | Plus or Pro | No |

### For people

For a local AI client, open **Fikr → Connections** and follow
the setup shown for that client. The connection stays on this computer and is
free. Fikr Studio must remain open.

For a remote agent or service, open
[Fikr Settings](https://www.fikr.one/dashboard/settings), create a Messenger
Hook, choose the destination project, then select **Copy instructions for
agent**. Give that copied text only to the trusted agent or service.

### For agents

Use local MCP only when running on the same computer as Fikr Studio. Use the
local URL and token supplied by **Connections**. Never expose that
endpoint to the internet.

For remote or background note delivery, use the complete Messenger Hook setup
copied by the user from Fikr Settings. Do not ask for a Relay API Key, Fikr user
ID, project ID, Firebase credential, or database credential. The hook is
already bound to the correct user and project.

Messenger only adds notes. Remote read, search, edit, delete, and canvas tools
are not provided by this hook. See [docs/messenger-notes.md](docs/messenger-notes.md)
for the full plain-language guide.

## File formats

- `.fikrdata`: versioned project export and import
- `.md`: Markdown export

## License

MIT. See [LICENSE](LICENSE).
