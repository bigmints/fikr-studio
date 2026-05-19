# Task Manager Skill

## Purpose
Manage the project task queue (`todo.toon`) — list, add, update, complete, and track task status across the full lifecycle.

Acts as the **single source of truth** for all work items. Every task — from feature implementation to bug fixes to refactoring — MUST be routed through this skill.

## When to Use
- **Session start** — Read current task list to plan next actions
- **Before starting work** — Claim a task by moving it to `in_progress`
- **After completing work** — Mark tasks as `completed` with a summary
- **When discovering gaps** — Add new tasks with dependencies
- **When planning** — Add tasks to `next` queue with priority

## Usage

```bash
./.agents/skills/task-manager/manage.sh list                    # Show all tasks (todo/in_progress/next/completed)
./.agents/skills/task-manager/manage.sh list --status todo      # Filter by status
./.agents/skills/task-manager/manage.sh add "task_name" "description" --priority high --component "path/to/file"
./.agents/skills/task-manager/manage.sh start "task_id"         # Move task from next/todo to in_progress
./.agents/skills/task-manager/manage.sh complete --id "task_id" # Move task from in_progress to completed
./.agents/skills/task-manager/manage.sh status "task_id"        # Show detailed status of a single task
./.agents/skills/task-manager/manage.sh --help                  # Show full help
```

## Commands

| Command    | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| `list`     | Show current task status — all tasks grouped by section                     |
| `list --status <s>` | Filter by status: `todo`, `in_progress`, `completed`, `next`      |
| `add`      | Add a new task. First positional arg is summary. Supports `--priority`, `--component` |
| `start`    | Claim a task — moves it from `next`/`todo` to `in_progress`                 |
| `complete` | Mark a task done — moves it from `in_progress` to `completed`. Requires `--id` |
| `status`   | Show detailed info for a single task: current section, priority, summary    |
| `update`   | Update task fields: `--id`, `--status`, `--priority`, `--summary`           |
| `--help`   | Print this help text                                                        |

## Task Lifecycle

Each task follows this lifecycle:

1. **Discovered** → Added to `todo.toon` with `status: todo` in the `next:` section
2. **Claimed** → Moved to `in_progress` via `start` when an agent begins work
3. **Completed** → Moved to `completed` via `complete` with a summary
4. **Archived** → Remains in `completed` for historical reference

## Status Values

| Status       | Meaning                                    |
|--------------|--------------------------------------------|
| `todo`       | Ready for work, not yet started            |
| `in_progress`| Actively being worked on                   |
| `completed`  | Finished, includes summary of what was done|
| `cancelled`  | Abandoned or superseded                    |

## Priority Levels

| Priority | Meaning                                      |
|----------|----------------------------------------------|
| `1`      | Critical — blocking all other work           |
| `2`      | High — important, should be next             |
| `3`      | Medium — standard priority                   |
| `4`      | Low — nice to have                           |
| `5`      | Lowest — can deprioritize                    |

## Output Format

All commands update `todo.toon` in TOON format. The file has these sections:

```toon
tasks:
  completed:
    - task_id:
        summary: "What was completed"
  in_progress:
    - task_id:
        status: in_progress
        priority: high
        component: "path/to/file"
        summary: "What is being worked on"
  next:
    - task_id:
        status: todo
        priority: medium
        summary: "What needs to be done"
```

## Integration Points

| Skill          | When to Use                                                 |
|----------------|-------------------------------------------------------------|
| `auto-context` | After updating tasks — log the change in worklog            |
| `heartbeat`    | Run `pulse.sh` before starting any claimed task             |
| `validate-code`| Run before marking a task as completed                     |
| `compress-worklog`| Run periodically to keep context budget under 64k tokens |

## Validation Checklist

Before using this skill, verify:

- [ ] `todo.toon` exists and is parseable TOON format
- [ ] Task IDs are unique and descriptive (snake_case)
- [ ] Tasks list current status accurately
- [ ] Completed tasks have a meaningful summary
- [ ] Dependencies are documented for blocked tasks
