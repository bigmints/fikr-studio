#!/bin/bash
# setup-hooks.sh — install git hooks for agent enforcement
# Run once per machine: bash .agents/skills/heartbeat/setup-hooks.sh

set -euo pipefail
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
SKILLS="$PROJECT_ROOT/.agents/skills"

GREEN=$(printf '\033[0;32m')
NC=$(printf '\033[0m')

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: not a git repository"
  exit 1
fi

install_hook() {
  local name="$1"
  local src="$2"
  if [ -f "$HOOKS_DIR/$name" ] && [ ! -L "$HOOKS_DIR/$name" ]; then
    echo "Warning: existing $name hook found — backing up to $name.bak"
    mv "$HOOKS_DIR/$name" "$HOOKS_DIR/$name.bak"
  fi
  cp "$src" "$HOOKS_DIR/$name"
  chmod +x "$HOOKS_DIR/$name"
  echo "${GREEN}✓${NC} Installed $name"
}

install_hook "pre-commit"  "$SKILLS/heartbeat/pre-commit.sh"
install_hook "post-commit" "$SKILLS/heartbeat/post-commit.sh"

echo ""
echo "Hooks installed. Every commit now:"
echo "  pre-commit:  blocks if no in_progress task · warns on stale heartbeat"
echo "  post-commit: auto-pulses heartbeat · auto-logs to worklog.toon"
