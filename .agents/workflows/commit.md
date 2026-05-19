---
title: Pre-Commit Validation
trigger: Before every git commit — mandatory
---

# Pre-Commit Validation

> Every check must pass before committing. No exceptions. No `--no-verify`.

---

## Steps

**1 — Run validation**
```bash
.agents/skills/validate-code/validate.sh
```
Runs lint + type check + build. Must exit 0. If not → fix and re-run from Step 1.

**2 — Self-review diff**
```
[ ] No debug console.log
[ ] No hardcoded absolute paths
[ ] No placeholder values (xxx, todo, fixme)
[ ] No unused imports
[ ] No commented-out code blocks
```

**3 — Commit**
```bash
git commit -m "<type>(<scope>): <what and why>"
# Types: feat · fix · chore · adr
```

**4 — Post-commit heartbeat**
```bash
.agents/skills/heartbeat/pulse.sh "Committed: <msg>"
```

---

## Errors

| Failure | Action |
|---------|--------|
| Lint / type / build error | Fix → re-run from Step 1 |
| 3+ failed attempts | STOP → escalate (format in `.agents/workflows/process.md §5`) |
