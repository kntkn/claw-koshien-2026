"""
Claw Koshien Logger SDK (Python)

Single-file, zero-dependency logger that posts structured embeds
to a Discord webhook. Uses only stdlib (urllib + threading).

Setup:
    export CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy"
    export CLAW_TEAM="TeamAlpha"

Usage:
    from claw_logger import tool, think, result, error, status

    tool("Reading auth.py")
    think("Considering JWT vs session-based auth")
    result("Authentication module implemented")
    error("Test suite failed: 2 assertions")
    status("Starting phase 2")
"""

import atexit
import json
import os
import threading
from datetime import datetime, timezone
from urllib.request import Request, urlopen

# --- Config (env vars only) ---
WEBHOOK_URL = os.environ.get("CLAW_WEBHOOK", "")
TEAM_NAME = os.environ.get("CLAW_TEAM", "unknown")
FLUSH_INTERVAL = 2.5  # seconds

# --- Constants ---
COLORS = {
    "tool": 3447003,  # blue
    "think": 9807270,  # gray
    "result": 5763719,  # green
    "error": 15548997,  # red
    "status": 16776960,  # yellow
}

ICONS = {
    "tool": "\U0001f527",
    "think": "\U0001f4ad",
    "result": "\u2705",
    "error": "\u274c",
    "status": "\U0001f4e1",
}

# --- Buffer ---
_buffer: list[dict] = []
_lock = threading.Lock()
_timer: threading.Timer | None = None


def _flush() -> None:
    """Flush buffered log entries to Discord webhook."""
    global _timer
    if not WEBHOOK_URL:
        return

    with _lock:
        if not _buffer:
            _timer = None
            return
        batch = _buffer[:]
        _buffer.clear()
        _timer = None

    embeds = [
        {
            "title": f"{ICONS[item['type']]} {item['type'].upper()}",
            "description": (
                item["detail"][:497] + "..."
                if len(item["detail"]) > 500
                else item["detail"]
            ),
            "color": COLORS[item["type"]],
            "footer": {"text": TEAM_NAME},
            "timestamp": item["timestamp"],
        }
        for item in batch
    ]

    # Discord allows max 10 embeds per message
    for i in range(0, len(embeds), 10):
        chunk = embeds[i : i + 10]
        try:
            data = json.dumps({"embeds": chunk}).encode()
            req = Request(
                WEBHOOK_URL,
                data=data,
                headers={"Content-Type": "application/json"},
            )
            urlopen(req, timeout=5)
        except Exception:
            pass  # Never block the bot for logging failures


# --- Public API ---


def log(type: str, detail: str) -> None:
    """Log an event. Batches calls and flushes every 2.5s."""
    global _timer
    if not WEBHOOK_URL:
        return

    with _lock:
        _buffer.append(
            {
                "type": type,
                "detail": detail,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        if _timer is None:
            _timer = threading.Timer(FLUSH_INTERVAL, _flush)
            _timer.daemon = True
            _timer.start()


def tool(detail: str) -> None:
    """Log a tool invocation (e.g., "Reading src/auth.py")"""
    log("tool", detail)


def think(detail: str) -> None:
    """Log a thinking step (e.g., "Comparing JWT vs session auth")"""
    log("think", detail)


def result(detail: str) -> None:
    """Log a result (e.g., "Auth module implemented, 3 tests passing")"""
    log("result", detail)


def error(detail: str) -> None:
    """Log an error (e.g., "Test failed: expected 200, got 401")"""
    log("error", detail)


def status(detail: str) -> None:
    """Log a status change (e.g., "Starting phase 2")"""
    log("status", detail)


def flush() -> None:
    """Force-flush the buffer immediately. Call before process exit."""
    _flush()


# --- Cleanup ---
atexit.register(_flush)
