---
description: Revoke exposed release credentials and prove a history rewrite without touching a dirty worktree
---

# Credential recovery

This workflow is required while `npm run check:history-secrets` fails.

## Ordering and confirmation gates

1. Complete GitHub sudo verification and identify the exposed legacy PAT by its
   fingerprint. Do not print or copy the token into chat or logs.
2. Ask for action-time confirmation immediately before revoking that PAT.
3. Create an isolated mirror or temporary clone. Never stash, reset, or rewrite
   the active Studio worktree.
4. Rewrite the isolated clone with `scripts/redact-known-history-secrets.mjs`.
5. Run `scripts/check-history-secrets.mjs` inside the rewritten clone; it must pass.
6. Ask for action-time confirmation immediately before the history-changing
   force push.
7. Force-push all rewritten branches and tags, then re-clone and run the scanner
   again against the remote result.

## Local proof command

This command rewrites only a disposable clone and does not contact GitHub:

```bash
SOURCE_REPO="$(git rev-parse --show-toplevel)"
PROOF_DIR="$(mktemp -d /tmp/fikr-studio-history-proof.XXXXXX)"
git clone --no-local "$SOURCE_REPO" "$PROOF_DIR/repo"
cd "$PROOF_DIR/repo"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force \
  --tag-name-filter cat \
  --tree-filter "node '$SOURCE_REPO/scripts/redact-known-history-secrets.mjs'" \
  -- --all
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
node "$SOURCE_REPO/scripts/check-history-secrets.mjs"
```

Keep the proof clone only until its scanner result is recorded, then delete it.
