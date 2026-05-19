#!/usr/bin/env bash
# heartbeat/pulse.sh
# Usage: pulse.sh "<current task description>"
# Writes a liveness timestamp to .agents/context/heartbeat.toon so
# humans and monitoring scripts can detect a stalled agent.

set -euo pipefail

TASK="${1:-unknown task}"
HEARTBEAT_FILE="$(git rev-parse --show-toplevel)/.agents/context/heartbeat.toon"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HOSTNAME=$(hostname -s 2>/dev/null || echo "unknown-host")

# Write (overwrite) the heartbeat file
cat > "$HEARTBEAT_FILE" <<EOF
heartbeat:
  last_seen: "$TIMESTAMP"
  host: "$HOSTNAME"
  task: "$TASK"
  status: alive
EOF

echo "[heartbeat] pulse written at $TIMESTAMP — task: $TASK"
