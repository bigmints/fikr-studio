---
title: Bootstrap
trigger: Every new agent session — mandatory
---

# Bootstrap

> Run at the start of every session. Read-only — changes nothing.

## Steps

**0 — Verify git hooks are installed** *(one-time check)*
```bash
ls .git/hooks/pre-commit .git/hooks/post-commit 2>/dev/null || bash .agents/skills/heartbeat/setup-hooks.sh
```
Hooks enforce task-claiming and auto-logging. If missing, install them before proceeding.

**1 — Verify repository root**
```bash
git rev-parse --show-toplevel  # must be .../cowork
```

**2 — Load context (always)**

| # | File | Extract |
|---|------|---------|
| 1 | `agents.md` | Your role |
| 2 | `.agents/workflows/process.md` | All rules |
| 3 | `.agents/context/context.toon` | Project state, stack, ADRs |

**3 — Load context (on demand — only when needed)**

These files are **discoverable**, not loaded unconditionally. Read them when relevant:

| File | When to load |
|------|-------------|
| `.agents/skills/task-manager/todo.toon` | Picking a task, resuming in-progress work, checking priorities |
| `.agents/context/adrs/` | Architecture decisions relevant to the current task |
| `git log --oneline -20` | Understanding recent changes (use git, not worklog) |

```bash
# Quick check — is there an in_progress task to resume?
grep "in_progress" .agents/skills/task-manager/todo.toon
# If yes → read full todo.toon for context
# If no → decide based on user request what to work on
```

**4 — Check heartbeat**
```bash
cat .agents/context/heartbeat.toon
```
| Age | Action |
|-----|--------|
| < 5 min | Continue |
| 5–30 min | Note it, continue |
| > 30 min | `pulse.sh "Session start"` first |

**5 — Claim a task** *(only when working on a specific task)*
```bash
.agents/skills/task-manager/manage.sh list
.agents/skills/task-manager/manage.sh start <task_id>
```
Rules: lowest priority number first · never claim `in_progress` · never re-claim `completed`

**6 — Start heartbeat**
```bash
.agents/skills/heartbeat/pulse.sh "<task_id>: starting"
```

---

Bootstrap complete → follow the WORK LOOP in `.agents/workflows/process.md`.

---

## Recovery

| Problem | Fix |
|---------|-----|
| `context.toon` parse error | `git checkout .agents/context/context.toon` |
| `todo.toon` corrupted | `git checkout .agents/skills/task-manager/todo.toon` |
| No tasks | `manage.sh add "<summary>" --priority 2` |
| Skills not found | Check `skill-index.toon` · verify `chmod +x` |
