---
title: Agent Process
version: "4.0"
authority: CANONICAL — overrides all other files
---

# Agent Process

> Single source of truth for HOW to work. Read this at the start of every session.

---

## 1. Four Rules — No Exceptions

| Rule | Command |
|------|---------|
| **Heartbeat** — before every task and after every commit | `.agents/skills/heartbeat/pulse.sh "<task>"` |
| **Token budget** — keep every prompt under 64k tokens | Stay under 50k working input; split large tasks |
| **Validate before commit** — zero broken code committed | `.agents/skills/validate-code/validate.sh` |
| **Context reflects reality** — update after structural changes | Update `context.toon` + write ADR if architectural |

---

## 2. Session Lifecycle

```
START → bootstrap.md → [WORK LOOP] → SESSION END (§6) → END
```

**Work loop:**
1. Write code / produce output
2. Self-review diff (no debug logs, no hardcoded paths, no placeholders)
3. `validate.sh` → must pass → see `commit.md`
4. `git commit -m "type(scope): what and why"`
5. `pulse.sh "Committed: <msg>"`
6. If structural change → update context (§5)

---

## 3. Decision Tree

| Situation | Action |
|-----------|--------|
| Starting a session | → `_shared/bootstrap.md` (always) |
| About to `git commit` | → `_shared/commit.md` (must pass first) |
| Made a structural change | → §5 — update context immediately |
| Ending a session | → §6 — session end checklist |
| Something went wrong | → §4 Error Recovery |

---

## 4. Error Recovery

| Symptom | Fix |
|---------|-----|
| `validate.sh` fails 3+ times | STOP → escalate |
| Context size > 50k tokens | `compress.sh` → trim history → retry |
| `context.toon` parse error | `git checkout .agents/context/context.toon` |
| Task not in `todo.toon` | `manage.sh list` → find or add it |
| Heartbeat stale (> 30 min) | `pulse.sh "resuming"` → continue |
| Skill script missing | Check `skill-index.toon` → verify `chmod +x` |
| ADR required but missing | Write ADR from `TEMPLATE.md` → then proceed |

**Stuck checklist:**
```
[ ] Heartbeat fresh (< 30 min)?    NO → pulse.sh "resuming"
[ ] Task claimed in todo.toon?     NO → manage.sh start <id>
[ ] Context < 50k tokens?          NO → compress.sh
[ ] ADR covers this decision?      NO → write ADR first
[ ] Requirements clear?            NO → STOP, ask the user
```

**Escalation format:**
```
BLOCKED: <one-line summary>
Context: <what you were doing>
Error:   <exact error>
Attempts:<what you tried>
Suggest: <your proposed next step>
```

---

## 5. Context Updates (after structural changes)

A **structural change** = new component/module, new dependency, new/modified skill, architectural decision, resolved issue.

Bug fixes and styling changes → **not structural**, skip this.

**Steps:**
1. **Write ADR first** if this is an architectural decision:
   ```bash
   cp .agents/context/adrs/TEMPLATE.md .agents/context/adrs/<NNN>-<title>.md
   # Fill: Context · Decision · Consequences · Status
   ```
2. **Update `context.toon`** — only relevant sections:
   - `stack:` — if tech stack changed
   - `key_decisions[]` — add new ADR or inline decision
   - `architecture:` — if core pattern changed
   - `project.last_updated` and `project.last_commit` — always
3. **Update `todo.toon`** via manage.sh — complete or add tasks
4. **Update `skill-index.toon`** if a skill was added or removed
5. **Commit context changes:**
   ```bash
   git add .agents/context/ .agents/skills/task-manager/todo.toon
   git commit -m "chore(context): <what changed>"
   ```

---

## 6. Session End Checklist

Run this before closing any session or completing a task:

```
[ ] pulse.sh "Session end: <task_id>"
[ ] manage.sh complete --id <id> --summary "<what was done>"
[ ] update-context.sh "<session summary>"
[ ] Structural changes logged in context.toon (if any)
[ ] All context files committed
[ ] No debug artifacts left in source code
```

```bash
.agents/skills/heartbeat/pulse.sh "Session end: <task_id>"
.agents/skills/task-manager/manage.sh complete --id <id> --summary "<what>"
.agents/skills/auto-context/update-context.sh "<summary>"
git add .agents/ && git commit -m "chore(context): session end — <task_id>"
```

---

## 7. ADR Rules

Write an ADR **before implementing** when you:
- Add a new dependency to `package.json` / `pubspec.yaml`
- Change folder structure significantly
- Switch an architectural pattern
- Make a decision affecting multiple files that is hard to reverse

Valid ADR requires all 4: **Context · Decision · Consequences · Status**

---

## 8. File Roles

| File | Purpose |
|------|---------|
| `AGENTS.md` | Entry point — role, stack, quick commands |
| `workflows/_shared/process.md` | All rules (this file) |
| `workflows/_shared/bootstrap.md` | Session start checklist |
| `workflows/_shared/commit.md` | Pre-commit validation gate |
| `workflows/_shared/log.md` | Log session summary to Fikr Studio |
| `context/context.toon` | Live project state — single source of truth |
| `context/heartbeat.toon` | Liveness timestamp (overwrite, never append) |
| `skills/task-manager/todo.toon` | Task queue — only via `manage.sh` |
| `context/adrs/` | Architecture decisions (append-only) |

---

## 9. Quick Commands

```bash
.agents/skills/heartbeat/pulse.sh "<msg>"
.agents/skills/task-manager/manage.sh list
.agents/skills/task-manager/manage.sh start <id>
.agents/skills/task-manager/manage.sh complete --id <id> --summary "<what>"
.agents/skills/validate-code/validate.sh
.agents/skills/auto-context/update-context.sh "<msg>"
git log --oneline -20
```

---

## 10. Git Hooks — Install Once

```bash
bash .agents/skills/heartbeat/setup-hooks.sh
```

| Hook | Enforcement |
|------|-------------|
| `pre-commit` | Blocks if no `in_progress` task · warns if heartbeat > 30 min stale |
| `post-commit` | Auto-runs `pulse.sh` + `update-context.sh` |
