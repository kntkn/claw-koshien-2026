#!/usr/bin/env bash
# Claw Koshien 2026 — PostToolUse hook reporter
# Reads hook payload from stdin and sends activity to relay server.
# Env vars: CLAW_RELAY_URL, CLAW_TEAM_ID, CLAW_TEAM_NAME, CLAW_API_KEY (optional)

set -euo pipefail

RELAY="${CLAW_RELAY_URL:-}"
TEAM_ID="${CLAW_TEAM_ID:-}"
TEAM_NAME="${CLAW_TEAM_NAME:-$TEAM_ID}"
API_KEY="${CLAW_API_KEY:-}"

# Bail silently if not configured
[[ -z "$RELAY" || -z "$TEAM_ID" ]] && exit 0

# Read hook payload from stdin
payload="$(cat)"

# Extract tool_name and a short summary from tool_input
tool_name="$(echo "$payload" | jq -r '.tool_name // empty' 2>/dev/null || true)"
[[ -z "$tool_name" ]] && exit 0

# Build a human-readable summary from tool_input (first 120 chars)
tool_input="$(echo "$payload" | jq -r '.tool_input // {} | to_entries | map(.key + "=" + (.value | tostring)[:60]) | join(", ")' 2>/dev/null || true)"
summary="${tool_input:0:120}"

# Determine status based on tool
status="working"
if [[ "$tool_name" == "Read" || "$tool_name" == "Glob" || "$tool_name" == "Grep" ]]; then
  status="thinking"
fi

# Build event JSON
event="$(jq -n \
  --arg type "progress" \
  --arg teamId "$TEAM_ID" \
  --arg teamName "$TEAM_NAME" \
  --arg status "$status" \
  --arg tool "$tool_name" \
  --arg summary "$summary" \
  '{type: $type, teamId: $teamId, teamName: $teamName, status: $status, tool: $tool, summary: $summary}')"

# Send in background, never block Claude Code
(curl -s -o /dev/null -X POST "${RELAY}/event" \
  -H "Content-Type: application/json" \
  ${API_KEY:+-H "Authorization: Bearer $API_KEY"} \
  -d "$event" \
  --connect-timeout 2 --max-time 3 2>/dev/null || true) &

exit 0
