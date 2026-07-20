# Fikr Studio

Fikr Studio is a macOS desktop workspace for capturing notes, organizing them
across list, masonry, and graph views, and optionally enriching them with AI.

This project is based on [Nodepad](https://github.com/mskayyali/nodepad) by
Saleh Kayyali and retains its MIT attribution.

## Supported product

- Local note capture works without an account.
- Electron stores the workspace in `~/.fikr-studio/workspace.json`.
- Projects can be exported to and imported from `.fikrdata` files.
- BYOK enrichment supports OpenRouter, OpenAI, and Google Gemini; credentials
  remain in Electron secure storage and provider requests run in the main process.
- Note content sent for enrichment goes directly to the selected provider.
- Plus and Pro users can opt into cloud synchronization through `fikr.one`.
- The local MCP server requires Fikr Studio to be running.

Fikr Studio does not currently promise production browser hosting, custom LLM
endpoints, Voice Notes integration, or fully offline generative AI.

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
| Plus/Pro sync | Local workspace cache | Sends workspace data to authenticated `fikr.one` sync APIs |
| Local relevance search | In-memory and workspace vectors | None |
| Plus/Pro semantic search | Cloud workspace | Authenticated `fikr.one` request |

## File formats

- `.fikrdata`: versioned project export and import
- `.md`: Markdown export

## License

MIT. See [LICENSE](LICENSE).
