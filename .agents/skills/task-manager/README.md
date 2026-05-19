# Task Manager Skill

> This is the official task queue for Cowork. Every piece of work — features, bugs, refactoring — MUST be routed through this skill. Do not track work in conversation memory or ad-hoc notes.

## When to Use

| Situation | Command |
|-----------|---------|
| Session start — see what's pending | `manage.sh list` |
| Before starting work — claim a task | `manage.sh start <task_id>` |
| After completing work | `manage.sh complete --id <task_id> --summary "<what was done>"` |
| New task discovered | `manage.sh add "<summary>" --priority <1-5>` |

## Commands

```bash
# List all tasks (grouped by status)
./.agents/skills/task-manager/manage.sh list

# Filter by status
./.agents/skills/task-manager/manage.sh list --status todo
./.agents/skills/task-manager/manage.sh list --status in_progress

# Add a task
./.agents/skills/task-manager/manage.sh add "<summary>" --priority 2

# Claim a task (moves to in_progress)
./.agents/skills/task-manager/manage.sh start <task_id>

# Complete a task
./.agents/skills/task-manager/manage.sh complete --id <task_id> --summary "<what was done>"

# Check single task status
./.agents/skills/task-manager/manage.sh status <task_id>

# Help
./.agents/skills/task-manager/manage.sh --help
```

## Task Lifecycle

```
todo → [manage.sh start] → in_progress → [manage.sh complete] → completed
```

Never skip steps. Never mark complete before work is validated.

## Priority Levels

| Priority | Meaning | When to Use |
|----------|---------|-------------|
| 1 | Critical — blocks all other work | Fix immediately |
| 2 | High — important, do next | This sprint |
| 3 | Medium — standard | Next sprint |
| 4 | Low — nice to have | Backlog |
| 5 | Lowest — future idea | Optional |

## Data File

Tasks live in `todo.toon` (same directory as this file). The file is the canonical task store — never edit it by hand. Always use `manage.sh`.
