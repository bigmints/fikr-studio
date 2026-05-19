#!/bin/bash
# validate.sh — Electron/React pre-commit validation
set -euo pipefail
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

RED=$(printf '\033[0;31m')
GREEN=$(printf '\033[0;32m')
NC=$(printf '\033[0m')

PASS=0
FAIL=0

check() {
  local label="$1"; shift
  if "$@" > /dev/null 2>&1; then
    echo "${GREEN}✓${NC} $label"; PASS=$((PASS + 1))
  else
    echo "${RED}✗${NC} $label"; FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== Agent Validation (Electron/React) ==="
echo ""

TODO=".agents/skills/task-manager/todo.toon"
if [ -f "$TODO" ]; then
  IN_PROGRESS=$(grep -A2 "^  in_progress:" "$TODO" | grep -v "^  in_progress:" | grep -v "^$" | head -1 || true)
  if [ -z "$IN_PROGRESS" ]; then
    echo "${RED}✗${NC} Active task — none found in todo.toon"
    FAIL=$((FAIL + 1))
  else
    echo "${GREEN}✓${NC} Active task — found in todo.toon"
    PASS=$((PASS + 1))
  fi
fi

echo ""
echo "=== Code Checks ==="
echo ""

check "lint" npm run lint
check "type-check" npx tsc --noEmit

echo ""
echo "=== Result ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "${RED}FAILED${NC} — $FAIL check(s) failed."
  exit 1
fi

echo "${GREEN}ALL PASSED${NC} — $PASS checks."
exit 0
