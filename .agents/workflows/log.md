# `/log-to-fikrpad`

**Purpose**: Send a comprehensive, well-formatted documentation summary of recent implementations or commits directly to the user's Fikr Studio canvas using the MCP Cloud Relay.

## When to use this
- After a major feature implementation is complete.
- Immediately before or after a `git commit` and `git push`.
- When the user explicitly requests to log the summary to Fikr Studio.

## Execution Steps

1. **Verify MCP Configuration**:
   - Ensure the `fikrpad-cloud` (or `fikrpad`) MCP server is active in your current context.
   - If it is not active, remind the user to ensure it is configured in `mcp_config.json` and tell them to reload the chat if necessary.

2. **Draft the Summary**:
   - The summary must be written like official documentation.
   - Include a high-level overview of the feature or bug fix.
   - Include bullet points for technical details, architecture decisions, and files modified.
   - Every workspace maps to a project in Fikr Studio (e.g., if you are working in `fikr-workspace`, the target project is implicitly understood by the user's current Fikr Studio state, but you should format the note so it makes sense in that context).

3. **Format the Payload**:
   - Use Markdown for bold text, lists, and code snippets.
   - Keep it concise but highly descriptive.

4. **Execute the MCP Tool Call**:
   - Call the `create_note` tool on the Fikr Studio MCP server.
   - Use the following parameters:
     - `text`: Your well-formatted Markdown summary.
     - `type`: "thesis" or "narrative" or "task" (choose the most appropriate).
     - `category`: "Changelog" or "Implementation" or "Commit Log".
     - `annotation`: A very short 1-sentence TL;DR of the change.

5. **Confirm with User**:
   - If the tool call succeeds, inform the user that the documentation has been successfully pushed to their Fikr Studio canvas.
