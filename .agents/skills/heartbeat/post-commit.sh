#!/bin/bash
# post-commit hook — auto-heartbeat + context update on every commit
# Install: cp post-commit.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
SKILLS_DIR="$PROJECT_ROOT/.agents/skills"

# Get commit message
COMMIT_MSG=$(git log -1 --pretty=%B)

# Update heartbeat
if [ -x "$SKILLS_DIR/heartbeat/pulse.sh" ]; then
  "$SKILLS_DIR/heartbeat/pulse.sh" "Committed: $COMMIT_MSG"
fi

# Check if .agents/ files changed
if git diff-tree --no-commit-id --name-only -r HEAD | grep -q "^\.agents/"; then
  if [ -x "$SKILLS_DIR/auto-context/update-context.sh" ]; then
    "$SKILLS_DIR/auto-context/update-context.sh" "Post-commit: $COMMIT_MSG"
  fi
fi

# Compress worklog if needed
WORKLOG="$PROJECT_ROOT/.agents/context/worklog.toon"
if [ -f "$WORKLOG" ]; then
  SIZE=$(wc -c < "$WORKLOG" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 100000 ]; then
    [ -x "$SKILLS_DIR/compress-worklog/compress.sh" ] && "$SKILLS_DIR/compress-worklog/compress.sh"
  fi
fi

exit 0
