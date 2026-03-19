#!/usr/bin/env bash
# Claw Koshien 2026 — Participant Setup
# Installs hook scripts and guides environment variable configuration.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$HOME/.claude/hooks"

echo "=== Claw Koshien 2026 — Participant Setup ==="
echo ""

# 1. Copy hook scripts
mkdir -p "$HOOKS_DIR"
cp "$SCRIPT_DIR/claw-reporter.sh" "$HOOKS_DIR/"
cp "$SCRIPT_DIR/claw-idle.sh" "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR/claw-reporter.sh" "$HOOKS_DIR/claw-idle.sh"
echo "[OK] Hook scripts installed to $HOOKS_DIR"

# 2. Prompt for environment variables
echo ""
echo "--- Environment Variables ---"
echo "Add the following to your shell profile (~/.zshrc or ~/.bashrc):"
echo ""

if [[ -z "${CLAW_RELAY_URL:-}" ]]; then
  read -rp "Relay URL (e.g. https://claw-relay.up.railway.app): " relay_url
else
  relay_url="$CLAW_RELAY_URL"
fi

if [[ -z "${CLAW_TEAM_ID:-}" ]]; then
  read -rp "Team ID (e.g. team-alpha): " team_id
else
  team_id="$CLAW_TEAM_ID"
fi

if [[ -z "${CLAW_TEAM_NAME:-}" ]]; then
  read -rp "Team Name (e.g. Team Alpha): " team_name
else
  team_name="$CLAW_TEAM_NAME"
fi

read -rp "API Key (leave empty if none): " api_key

echo ""
echo "# --- Claw Koshien 2026 ---"
echo "export CLAW_RELAY_URL=\"$relay_url\""
echo "export CLAW_TEAM_ID=\"$team_id\""
echo "export CLAW_TEAM_NAME=\"$team_name\""
[[ -n "$api_key" ]] && echo "export CLAW_API_KEY=\"$api_key\""
echo "# --- End Claw Koshien ---"

echo ""
echo "--- Claude Code Hooks ---"
echo "Add the hooks config to your Claude Code settings."
echo "See: participant-kit/settings-snippet.json"
echo ""
echo "Merge the hooks section into: ~/.claude/settings.json"
echo "  or your project's .claude/settings.json"
echo ""
echo "[DONE] Setup complete. Restart your shell, then run Claude Code."
