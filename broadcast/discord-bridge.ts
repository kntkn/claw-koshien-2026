/**
 * OpenClaw → Discord bridge.
 * Reads Claude Code session JSONL and posts progress to a Discord webhook.
 *
 * Usage: WEBHOOK_URL=https://discord.com/api/webhooks/... TEAM_ID=a TEAM_NAME="Team A" SESSION_DIR=./sessions bun run broadcast/discord-bridge.ts
 */

import { watch } from "fs";

const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const TEAM_ID = process.env.TEAM_ID ?? "unknown";
const TEAM_NAME = process.env.TEAM_NAME ?? "Unknown Team";
const SESSION_DIR = process.env.SESSION_DIR ?? "./sessions";
const RELAY_URL = process.env.RELAY_URL ?? "http://localhost:9001";

if (!WEBHOOK_URL) {
  console.error("WEBHOOK_URL is required");
  process.exit(1);
}

let lastProcessedLine = 0;
let currentFile = "";

// Find the most recent .jsonl file
async function findLatestSession(): Promise<string | null> {
  const glob = new Bun.Glob("*.jsonl");
  let latest = "";
  let latestMtime = 0;

  for await (const file of glob.scan(SESSION_DIR)) {
    const path = `${SESSION_DIR}/${file}`;
    const stat = await Bun.file(path).stat();
    if (stat && stat.mtimeMs > latestMtime) {
      latestMtime = stat.mtimeMs;
      latest = path;
    }
  }

  return latest || null;
}

interface ToolUse {
  type: string;
  name: string;
  input?: Record<string, unknown>;
}

function parseJSONLLine(line: string): { tool?: string; summary?: string; status?: string } | null {
  try {
    const obj = JSON.parse(line);

    // Look for tool_use in message content
    if (obj.message?.content && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (block.type === "tool_use" || block.type === "toolCall") {
          const toolName = block.name ?? block.function?.name ?? "Unknown";
          const summary = summarizeToolInput(toolName, block.input ?? block.function?.arguments ?? {});
          return { tool: toolName, summary, status: "working" };
        }
      }
    }

    // Look for thinking blocks
    if (obj.message?.content && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (block.type === "thinking") {
          return { tool: "", summary: "Thinking...", status: "thinking" };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

function summarizeToolInput(tool: string, input: Record<string, unknown>): string {
  if (tool === "Read" || tool === "read") return `Reading ${input.file_path ?? "file"}`;
  if (tool === "Write" || tool === "write") return `Writing ${input.file_path ?? "file"}`;
  if (tool === "Edit" || tool === "edit") return `Editing ${input.file_path ?? "file"}`;
  if (tool === "Bash" || tool === "bash") return `Running command`;
  if (tool === "Grep" || tool === "grep") return `Searching for ${input.pattern ?? "pattern"}`;
  if (tool === "Glob" || tool === "glob") return `Finding files`;
  if (tool.includes("github")) return `GitHub operation`;
  if (tool.includes("slack")) return `Slack operation`;
  if (tool.includes("notion")) return `Notion operation`;
  return `Using ${tool}`;
}

async function processNewLines(filePath: string) {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split("\n").filter(Boolean);

  if (filePath !== currentFile) {
    currentFile = filePath;
    lastProcessedLine = Math.max(0, lines.length - 3); // Process last 3 lines on new file
  }

  for (let i = lastProcessedLine; i < lines.length; i++) {
    const parsed = parseJSONLLine(lines[i]);
    if (!parsed) continue;

    const discordMsg = parsed.tool
      ? `[TOOL] ${parsed.tool} | ${parsed.summary}`
      : `[STATUS] ${parsed.status}`;

    // Post to Discord webhook
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: discordMsg,
          username: TEAM_NAME,
        }),
      });
    } catch {
      // Silent fail
    }

    // Also POST to relay directly
    try {
      await fetch(`${RELAY_URL}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "progress",
          teamId: TEAM_ID,
          teamName: TEAM_NAME,
          status: parsed.status ?? "working",
          tool: parsed.tool ?? "",
          summary: parsed.summary ?? "",
        }),
      });
    } catch {
      // Silent fail
    }
  }

  lastProcessedLine = lines.length;
}

// --- Main ---
async function main() {
  console.log(`[discord-bridge] Watching ${SESSION_DIR} for team ${TEAM_NAME} (${TEAM_ID})`);

  // Initial scan
  const initial = await findLatestSession();
  if (initial) {
    console.log(`[discord-bridge] Found session: ${initial}`);
    await processNewLines(initial);
  }

  // Watch for changes
  watch(SESSION_DIR, { recursive: false }, async (eventType, filename) => {
    if (!filename?.endsWith(".jsonl")) return;
    const filePath = `${SESSION_DIR}/${filename}`;
    await processNewLines(filePath);
  });
}

main().catch(console.error);
