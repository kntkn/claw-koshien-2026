#!/usr/bin/env bash
# Claw Koshien 2026 — Stop hook (idle reporter)
# Sends idle status when Claude Code finishes responding.
# Env vars: CLAW_RELAY_URL, CLAW_TEAM_ID, CLAW_TEAM_NAME, CLAW_API_KEY (optional)

set -euo pipefail

RELAY="${CLAW_RELAY_URL:-}"
TEAM_ID="${CLAW_TEAM_ID:-}"
TEAM_NAME="${CLAW_TEAM_NAME:-$TEAM_ID}"
API_KEY="${CLAW_API_KEY:-}"

# Bail silently if not configured
[[ -z "$RELAY" || -z "$TEAM_ID" ]] && exit 0

event="$(jq -n \
  --arg type "progress" \
  --arg teamId "$TEAM_ID" \
  --arg teamName "$TEAM_NAME" \
  --arg status "idle" \
  --arg tool "" \
  --arg summary "" \
  '{type: $type, teamId: $teamId, teamName: $teamName, status: $status, tool: $tool, summary: $summary}')"

(curl -s -o /dev/null -X POST "${RELAY}/event" \
  -H "Content-Type: application/json" \
  ${API_KEY:+-H "Authorization: Bearer $API_KEY"} \
  -d "$event" \
  --connect-timeout 2 --max-time 3 2>/dev/null || true) &

exit 0
