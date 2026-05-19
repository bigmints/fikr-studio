# Heartbeat Skill

## Purpose

Tracks agent liveness by writing a timestamped heartbeat file at the start of each task and after every commit. Enables humans and CI to detect stalled agents quickly without monitoring logs.

## When to Use

Agents MUST call `pulse.sh` at two specific moments:

1. **At the start of every task** — before any file reads or code changes
2. **After every commit** — to record the commit as the last known activity

Humans use `check.sh` from a separate terminal to verify agent liveness.

## Available Scripts

### pulse.sh

Writes a liveness timestamp to `.agents/context/heartbeat.toon`.

**Usage:**
```bash
./.agents/skills/heartbeat/pulse.sh "<Current task description>"
```

**Example:**
```bash
./.agents/skills/heartbeat/pulse.sh "Implementing auth middleware"
./.agents/skills/heartbeat/pulse.sh "Committed: feat: add JWT refresh token logic"
```

**Output:**
Writes the heartbeat file with `last_seen`, `host`, `task`, and `status` fields.

### check.sh

Reads the heartbeat file and reports whether the agent is alive.

**Usage:**
```bash
./.agents/skills/heartbeat/check.sh                          # default 10 min threshold
./.agents/skills/heartbeat/check.sh --timeout-minutes 5       # custom threshold
```

**Exit codes:**
- `0` — agent is alive (pulse within threshold)
- `1` — agent appears stalled or heartbeat file missing

## Implementation Details

The heartbeat file is intentionally **always overwritten** (not appended) so it always reflects the agent's most recent known state.

**File:** `.agents/context/heartbeat.toon`

**Format:**
```yaml
heartbeat:
  last_seen: "2026-05-12T18:12:40Z"
  host: "BigMac-2"
  task: "Fix Tensor.location ONNX error"
  status: alive
```

## Validation Gates

Before using this skill, verify:
- [ ] The pulse.sh script is executable (`chmod +x`)
- [ ] `.agents/context/` directory exists
- [ ] A meaningful task description is provided (not empty)
