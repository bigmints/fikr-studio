#!/bin/bash

set -e

echo "Running worklog compression..."
node .agents/skills/compress-worklog/compress.mjs

# Commit the compressed worklog so compression is tracked in git history
if git diff --quiet .agents/context/worklog.toon; then
  echo "Nothing to commit — worklog was already small enough."
else
  git add .agents/context/worklog.toon
  git commit -m "chore(context): compress worklog [auto]"
  echo "Compressed worklog committed."
fi
