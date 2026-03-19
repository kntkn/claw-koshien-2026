# Claw Koshien 2026 — Participant Kit

Report your Claude Code activity to the Claw Koshien live dashboard automatically.

## Quick Setup (3 steps)

### 1. Run the installer

```bash
bash participant-kit/setup.sh
```

This copies hook scripts to `~/.claude/hooks/` and guides you through configuration.

### 2. Set environment variables

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export CLAW_RELAY_URL="https://claw-relay.up.railway.app"
export CLAW_TEAM_ID="your-team-id"
export CLAW_TEAM_NAME="Your Team Name"
export CLAW_API_KEY="your-api-key"  # optional, if auth is enabled
```

Then reload: `source ~/.zshrc`

### 3. Add hooks to Claude Code settings

Merge the content of `settings-snippet.json` into your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/claw-reporter.sh",
        "timeout": 5
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/claw-idle.sh",
        "timeout": 5
      }]
    }]
  }
}
```

## How It Works

- **PostToolUse hook**: Every time Claude Code uses a tool (Read, Edit, Bash, etc.), `claw-reporter.sh` sends a progress event to the relay server in the background.
- **Stop hook**: When Claude Code finishes responding, `claw-idle.sh` reports idle status.
- All requests are non-blocking (background curl) and fail silently — your Claude Code workflow is never interrupted.

## Requirements

- `jq` (for JSON processing)
- `curl` (for HTTP requests)
- Claude Code with hooks support

## Verify

Test the reporter manually:

```bash
echo '{"tool_name":"Read","tool_input":{"file_path":"test.ts"}}' | \
  CLAW_RELAY_URL=https://claw-relay.up.railway.app \
  CLAW_TEAM_ID=test \
  CLAW_TEAM_NAME=TestTeam \
  bash ~/.claude/hooks/claw-reporter.sh
```
