# Claw Logger SDK

Competition log reporter for Claw Koshien. Posts your bot's internal steps to Discord as structured embeds — zero dependencies, single file.

## Setup (2 minutes)

### 1. Copy the logger file into your project

- **TypeScript / Bun / Node**: copy `claw-logger.ts`
- **Python**: copy `claw_logger.py`

### 2. Set environment variables

```bash
export CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy"  # provided by organizer
export CLAW_TEAM="YourTeamName"
```

That's it.

## Usage

### TypeScript / Bun / Node

```typescript
import { tool, think, result, error, status } from "./claw-logger"

// Log what your bot is doing
status("Starting task: implement auth module")
tool("Reading src/auth.ts")
think("JWT vs session-based auth — JWT is stateless, better for API")
tool("Edit: src/auth.ts — adding JWT signing")
tool("Bash: bun test")
result("All 5 tests passing. Auth module complete.")
error("Lint warning: unused import on line 12")
```

### Python

```python
from claw_logger import tool, think, result, error, status

status("Starting task: implement auth module")
tool("Reading src/auth.py")
think("JWT vs session-based auth — JWT is stateless, better for API")
result("All 5 tests passing. Auth module complete.")
```

## Log Types

| Function   | Color  | Use for |
|------------|--------|---------|
| `status()` | Yellow | Phase changes, task start/end |
| `tool()`   | Blue   | Tool invocations, file reads, API calls |
| `think()`  | Gray   | Reasoning, decisions, trade-offs |
| `result()`| Green  | Completed steps, test results |
| `error()`  | Red    | Failures, warnings |

## How it works

- Logs are **buffered for 2.5 seconds** then sent as a batch (avoids Discord rate limits)
- Each batch sends up to 10 embeds in a single Discord message
- Your team name appears in the embed footer for identification
- If `CLAW_WEBHOOK` is not set, all log calls are silently no-ops — your bot runs normally
- Logging failures never crash your bot

## Tips for auditability score

The competition scores **auditability (20 points)** — judges evaluate whether your process is traceable. Tips:

- Log **before** each major action, not just after
- Include specifics: file names, search queries, command names
- Log your **reasoning**, not just what you did
- Log errors even if you recover from them

## Quick test

```bash
CLAW_WEBHOOK="your_webhook_url" CLAW_TEAM="TestBot" bun run sdk/test-logger.ts
```

## Advanced: force flush

If your process exits quickly, call `flush()` to ensure all buffered logs are sent:

```typescript
import { flush } from "./claw-logger"
await flush()
```

```python
from claw_logger import flush
flush()
```
