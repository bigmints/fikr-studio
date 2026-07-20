#!/bin/bash

if [[ "$1" == "--help" || -z "$1" ]]; then
  echo "Usage: ./.agents/skills/auto-context/update-context.sh \"<Work description>\""
  echo "Appends a new manual entry to the agent worklog in TOON format."
  exit 0
fi

# Pass all arguments to the node script
node .agents/skills/auto-context/update-context.mjs "$@"
