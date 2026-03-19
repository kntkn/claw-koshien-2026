/**
 * Quick test for claw-logger SDK
 *
 * Usage:
 *   CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy" \
 *   CLAW_TEAM="TestBot" \
 *   bun run sdk/test-logger.ts
 */

import { tool, think, result, error, status, flush } from "./claw-logger";

if (!process.env.CLAW_WEBHOOK) {
  console.error("Error: CLAW_WEBHOOK env var is required");
  console.error(
    'Usage: CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy" CLAW_TEAM="TestBot" bun run sdk/test-logger.ts',
  );
  process.exit(1);
}

console.log(`Team: ${process.env.CLAW_TEAM ?? "unknown"}`);
console.log("Sending test logs...\n");

// Simulate a typical agent workflow
status("Starting task: implement auth module");
tool("Reading src/auth.ts");
tool("Grep: searching for 'handleLogin'");
think("Considering JWT vs session-based authentication");
tool("Edit: updating src/auth.ts — adding JWT signing");
tool("Bash: bun test");
result("All 5 tests passing. Auth module complete.");
error("Lint warning: unused import on line 12 (non-blocking)");

// Force flush and wait
console.log("Flushing buffer...");
await flush();
console.log("Done! Check Discord #log💻 channel.");
