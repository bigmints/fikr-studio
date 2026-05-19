#!/bin/bash
# pre-commit hook — blocks commits with no active task and no heartbeat
# Installed by: bash .agents/skills/heartbeat/setup-hooks.sh

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
TODO="$PROJECT_ROOT/.agents/skills/task-manager/todo.toon"
HEARTBEAT="$PROJECT_ROOT/.agents/context/heartbeat.toon"

RED=$(printf '\033[0;31m')
YELLOW=$(printf '\033[1;33m')
NC=$(printf '\033[0m')

# ── 1. Block if only .agents/ context files are changing (context-only commits skip task check)
CHANGED=$(git diff --cached --name-only)
NON_AGENT=$(echo "$CHANGED" | grep -v "^\.agents/" | grep -v "^prd\.yml" || true)

if [ -z "$NON_AGENT" ]; then
  # Context-only commit — always allow
  exit 0
fi

# ── 2. Require an in_progress task
if [ -f "$TODO" ]; then
  IN_PROGRESS=$(grep -A2 "^  in_progress:" "$TODO" | grep -v "^  in_progress:" | grep -v "^$" | head -1 || true)
  if [ -z "$IN_PROGRESS" ]; then
    echo ""
    echo "${RED}[AGENT GATE] COMMIT BLOCKED${NC}"
    echo ""
    echo "  No task is in_progress in todo.toon."
    echo "  Run: .agents/skills/task-manager/manage.sh start <task_id>"
    echo "  Or add a task: .agents/skills/task-manager/manage.sh add \"<summary>\" --priority 2"
    echo ""
    exit 1
  fi
fi

# ── 3. Warn if heartbeat is stale (>30 min) — warn only, don't block
if [ -f "$HEARTBEAT" ]; then
  LAST_SEEN=$(grep "last_seen:" "$HEARTBEAT" | sed 's/.*"\(.*\)".*/\1/' || true)
  if [ -n "$LAST_SEEN" ]; then
    NOW=$(date -u +%s)
    THEN=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_SEEN" +%s 2>/dev/null || echo "$NOW")
    AGE=$(( (NOW - THEN) / 60 ))
    if [ "$AGE" -gt 30 ]; then
      echo "${YELLOW}[AGENT GATE] WARNING: Heartbeat is ${AGE} min stale. Run pulse.sh before continuing.${NC}"
    fi
  fi
fi

exit 0
