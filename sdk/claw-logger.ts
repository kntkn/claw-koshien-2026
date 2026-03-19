/**
 * Claw Koshien Logger SDK (TypeScript / Bun / Node)
 *
 * Single-file, zero-dependency logger that posts structured embeds
 * to a Discord webhook. Designed for competition participants.
 *
 * Setup:
 *   export CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy"
 *   export CLAW_TEAM="TeamAlpha"
 *
 * Usage:
 *   import { tool, think, result, error, status } from "./claw-logger"
 *
 *   tool("Reading auth.ts")
 *   think("Considering JWT vs session-based auth")
 *   result("Authentication module implemented")
 *   error("Test suite failed: 2 assertions")
 *   status("Starting phase 2")
 */

// --- Config (env vars only) ---
const WEBHOOK_URL = process.env.CLAW_WEBHOOK ?? "";
const TEAM_NAME = process.env.CLAW_TEAM ?? "unknown";
const FLUSH_INTERVAL_MS = 2500;

// --- Types ---
type LogType = "tool" | "think" | "result" | "error" | "status";

interface BufferedEntry {
  type: LogType;
  detail: string;
  timestamp: string;
}

// --- Constants ---
const COLORS: Record<LogType, number> = {
  tool: 3447003, // blue
  think: 9807270, // gray
  result: 5763719, // green
  error: 15548997, // red
  status: 16776960, // yellow
};

const ICONS: Record<LogType, string> = {
  tool: "\u{1F527}",
  think: "\u{1F4AD}",
  result: "\u2705",
  error: "\u274C",
  status: "\u{1F4E1}",
};

// --- Buffer ---
let buffer: BufferedEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (!WEBHOOK_URL || buffer.length === 0) return;

  const batch = buffer.splice(0);
  const embeds = batch.map(({ type, detail, timestamp }) => ({
    title: `${ICONS[type]} ${type.toUpperCase()}`,
    description: detail.length > 500 ? detail.slice(0, 497) + "..." : detail,
    color: COLORS[type],
    footer: { text: TEAM_NAME },
    timestamp,
  }));

  // Discord allows max 10 embeds per message
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: chunk }),
      });
    } catch {
      // Never block the bot for logging failures
    }
  }
}

// --- Public API ---

/** Log an event. Batches calls and flushes every 2.5s. */
export function log(type: LogType, detail: string): void {
  if (!WEBHOOK_URL) return;

  buffer.push({
    type,
    detail,
    timestamp: new Date().toISOString(),
  });

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }
}

/** Log a tool invocation (e.g., "Reading src/auth.ts") */
export const tool = (detail: string): void => log("tool", detail);

/** Log a thinking step (e.g., "Comparing JWT vs session auth") */
export const think = (detail: string): void => log("think", detail);

/** Log a result (e.g., "Auth module implemented, 3 tests passing") */
export const result = (detail: string): void => log("result", detail);

/** Log an error (e.g., "Test failed: expected 200, got 401") */
export const error = (detail: string): void => log("error", detail);

/** Log a status change (e.g., "Starting phase 2") */
export const status = (detail: string): void => log("status", detail);

/** Force-flush the buffer immediately. Call before process exit. */
export { flush };

// --- Cleanup ---
process.on("beforeExit", () => {
  flush();
});
