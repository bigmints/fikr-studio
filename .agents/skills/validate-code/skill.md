---
name: validate-code
description: Run Electron/Next.js lint + type check. Must pass before any git commit.
---

# Validate Code

```bash
npm run lint        # 0 errors required
npx tsc --noEmit    # 0 type errors required
```

**A commit is blocked until both pass.**

Used by: `pre-commit.sh` git hook, `workflows/commit.md`
