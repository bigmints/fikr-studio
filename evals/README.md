# Fikr Chat evals

These evals exercise the real `runFikrAgent` orchestration path, the live local MCP server, and the Electron UI. Destructive cases must target an explicit workspace under `/private/tmp`; the live MCP runner refuses any other workspace.

Coverage includes every built-in Chat tool, every local Fikr MCP tool, exact inventory, scoped retrieval, citations, follow-up transformations, attachment understanding, prompt-injection resistance, failure recovery, cancellation, explicit save approval, chat deletion/undo, and creation persistence/deletion/undo.

Generate the deterministic embedded-text PDF, image-only scanned PDF, and PNG
vision fixtures before a manual Electron attachment pass:

```bash
python3 evals/generate-attachment-fixtures.py
```

Run deterministic agent and domain cases with `npm test`. Run the live MCP matrix only while an isolated Electron instance is active:

```bash
node evals/run-live-mcp.mjs \
  --workspace /private/tmp/fikr-studio-chat-attachment-electron-qa \
  --lockfile "$HOME/Library/Application Support/fikr-studio/mcp-port.json"
```

The live runner leaves one empty `QA Chat Tools ...` Space so its final cleanup can be verified through the Electron UI. It never writes tokens, URLs, note contents, or real workspace data to its result file.
