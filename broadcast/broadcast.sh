#!/bin/bash
# broadcast.sh — Send agent metadata to Claw Koshien relay server
# Usage: AGENT_NAME="MyAgent" RELAY_URL="ws://192.168.x.x:9001" ./broadcast.sh
#
# Reads the latest Claude Code session and sends:
#   - Agent name, status (thinking/working/idle), current tool, 1-line summary
#   - Does NOT send conversation content or file contents
#
# Requires: jq, websocat

set -euo pipefail

AGENT_NAME="${AGENT_NAME:-$(hostname)}"
RELAY_URL="${RELAY_URL:-ws://localhost:9001}"
DESK_ID="${DESK_ID:-desk-0}"
INTERVAL="${INTERVAL:-3}"

# Claude Code session directory
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude/projects}"
FILTER_FILE="$(mktemp)"

cat > "$FILTER_FILE" << 'JQEOF'
# Determine status from recent activity
(
  [.[] | select(.type == "assistant") | select((.message.content | type) == "array") |
    .message.content[] | select(.type == "tool_use") | .name
  ] | last // ""
) as $lastTool |

(
  [.[] | select(.type == "assistant") | select((.message.content | type) == "array") |
    .message.content[] | select(.type == "text") | .text
  ] | last // ""
) as $lastText |

# Check if there's recent thinking
(
  [.[] | select(.type == "assistant") | select((.message.content | type) == "array") |
    .message.content[] | select(.type == "thinking")
  ] | length > 0
) as $hasThinking |

{
  status: (if $lastTool != "" then "working" elif $hasThinking then "thinking" else "idle" end),
  tool: $lastTool,
  summary: ($lastText | if length > 80 then .[:80] + "..." else . end)
}
JQEOF

cleanup() {
  rm -f "$FILTER_FILE"
}
trap cleanup EXIT

echo "[broadcast] Sending as '${AGENT_NAME}' (${DESK_ID}) to ${RELAY_URL}"
echo "[broadcast] Press Ctrl+C to stop"

while true; do
  # Find newest session file
  LATEST=$(find "$CLAUDE_DIR" -maxdepth 2 -name '*.jsonl' -type f -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -1)

  if [ -z "$LATEST" ]; then
    # No active session — send idle
    echo "{\"type\":\"state\",\"id\":\"${DESK_ID}\",\"name\":\"${AGENT_NAME}\",\"status\":\"idle\",\"tool\":\"\",\"summary\":\"\"}" \
      | websocat -n1 "$RELAY_URL" 2>/dev/null || true
    sleep "$INTERVAL"
    continue
  fi

  # Check freshness (120s)
  if [ "$(uname)" = "Darwin" ]; then
    MTIME=$(stat -f %m "$LATEST" 2>/dev/null)
  else
    MTIME=$(stat -c %Y "$LATEST" 2>/dev/null)
  fi
  NOW=$(date +%s)
  AGE=$(( NOW - MTIME ))

  if [ "$AGE" -gt 120 ]; then
    echo "{\"type\":\"state\",\"id\":\"${DESK_ID}\",\"name\":\"${AGENT_NAME}\",\"status\":\"idle\",\"tool\":\"\",\"summary\":\"\"}" \
      | websocat -n1 "$RELAY_URL" 2>/dev/null || true
    sleep "$INTERVAL"
    continue
  fi

  # Parse last 100 lines
  RESULT=$(tail -100 "$LATEST" | jq -s -f "$FILTER_FILE" 2>/dev/null || echo '{}')

  STATUS=$(echo "$RESULT" | jq -r '.status // "idle"')
  TOOL=$(echo "$RESULT" | jq -r '.tool // ""')
  SUMMARY=$(echo "$RESULT" | jq -r '.summary // ""')

  # Send state update
  jq -n \
    --arg type "state" \
    --arg id "$DESK_ID" \
    --arg name "$AGENT_NAME" \
    --arg status "$STATUS" \
    --arg tool "$TOOL" \
    --arg summary "$SUMMARY" \
    '{type:$type, id:$id, name:$name, status:$status, tool:$tool, summary:$summary}' \
    | websocat -n1 "$RELAY_URL" 2>/dev/null || true

  sleep "$INTERVAL"
done
