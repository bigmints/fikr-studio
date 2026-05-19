# Run Prompt Queue

Execute YAML queued tasks autonomously, one after another.

```bash
# List available queues
ls .agents/queue/*.yaml 2>/dev/null

# Dry run
.agents/skills/minions/scripts/minions --queue .agents/queue/<file>.yaml --workdir . --dry-run

# Execute
.agents/skills/minions/scripts/minions --queue .agents/queue/<file>.yaml --workdir . --continue-on-error

# Update status
echo "Ran <file>.yaml — $(date)" >> .agents/queue/status.md
```
