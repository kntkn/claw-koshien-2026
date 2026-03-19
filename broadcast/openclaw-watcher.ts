/**
 * OpenClaw Session Watcher
 *
 * Watches OpenClaw agent JSONL session files in real-time and posts
 * tool calls to a Discord webhook (log💻 channel).
 *
 * Unlike Claude Code hooks (which don't fire in OpenClaw's gateway),
 * this watches the session files from the host side using fs.watch.
 *
 * Usage:
 *   CLAW_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy" \
 *   bun run broadcast/openclaw-watcher.ts
 *
 * Env:
 *   CLAW_WEBHOOK   — Discord webhook URL (required)
 *   AGENTS         — Comma-separated agent names (default: ceo,cmo,coo,cto,cfo,kento)
 *   SESSION_BASE   — Base path for agent sessions (default: ~/.openclaw-{agent}/agents/{agent}/sessions)
 */

import { watch, readFileSync, statSync, existsSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";

const WEBHOOK_URL = process.env.CLAW_WEBHOOK ?? "";
if (!WEBHOOK_URL) {
  console.error("CLAW_WEBHOOK is required");
  process.exit(1);
}

const AGENT_NAMES = (process.env.AGENTS ?? "ceo,cmo,coo,cto,cfo,kento")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HOME = homedir();
const FLUSH_INTERVAL_MS = 2500;
const MAX_EMBEDS_PER_MSG = 10;

// --- Colors ---
const COLORS: Record<string, number> = {
  message: 3447003, // blue — sending Discord/Slack messages
  exec: 10181046, // purple — executing commands
  read: 9807270, // gray — reading files
  write: 5763719, // green — writing files
  memory_search: 16776960, // yellow — memory search
  memory_get: 16776960, // yellow — memory operations
  default: 3447003,
};

const ICONS: Record<string, string> = {
  message: "\u{1F4AC}",
  exec: "\u{1F4BB}",
  read: "\u{1F4C4}",
  write: "\u270F\uFE0F",
  memory_search: "\u{1F50D}",
  memory_get: "\u{1F9E0}",
  default: "\u{1F527}",
};

// --- Buffer for rate limiting ---
interface LogEntry {
  agent: string;
  toolName: string;
  detail: string;
  timestamp: string;
}

let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (!buffer.length) return;
  const batch = buffer.splice(0);

  const embeds = batch.map(({ agent, toolName, detail, timestamp }) => ({
    title: `${ICONS[toolName] ?? ICONS.default} ${toolName}`,
    description: detail.length > 500 ? detail.slice(0, 497) + "..." : detail,
    color: COLORS[toolName] ?? COLORS.default,
    footer: { text: agent },
    timestamp,
  }));

  for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MSG) {
    const chunk = embeds.slice(i, i + MAX_EMBEDS_PER_MSG);
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: chunk }),
      });
    } catch {
      // Silent fail
    }
  }
}

function enqueue(entry: LogEntry): void {
  buffer.push(entry);
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }
}

// --- Session file tracking ---
interface AgentState {
  agent: string;
  sessionDir: string;
  currentFile: string | null;
  fileOffset: number;
}

function getSessionDir(agent: string): string {
  return resolve(HOME, `.openclaw-${agent}`, "agents", agent, "sessions");
}

function findLatestJsonl(dir: string): string | null {
  if (!existsSync(dir)) return null;
  try {
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith(".jsonl") && f !== "sessions.json")
      .map((f: string) => ({
        name: f,
        mtime: statSync(join(dir, f)).mtimeMs,
      }))
      .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);
    return files[0]?.name ?? null;
  } catch {
    return null;
  }
}

function readdirSync(dir: string): string[] {
  try {
    return require("fs").readdirSync(dir);
  } catch {
    return [];
  }
}

function processNewLines(state: AgentState): void {
  if (!state.currentFile) return;
  const filePath = join(state.sessionDir, state.currentFile);

  try {
    const stat = statSync(filePath);
    if (stat.size <= state.fileOffset) return;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    // Find new lines after offset
    let currentPos = 0;
    for (const line of lines) {
      const lineEnd = currentPos + Buffer.byteLength(line + "\n", "utf-8");
      if (currentPos >= state.fileOffset) {
        try {
          const entry = JSON.parse(line);
          processEntry(state.agent, entry);
        } catch {
          // Skip malformed lines
        }
      }
      currentPos = lineEnd;
    }

    state.fileOffset = stat.size;
  } catch {
    // File might be locked
  }
}

function processEntry(agent: string, entry: any): void {
  if (entry.type !== "message") return;
  const msg = entry.message;
  if (!msg || msg.role !== "assistant") return;

  for (const block of msg.content ?? []) {
    if (block.type !== "toolCall") continue;

    const toolName = block.name ?? "unknown";
    const args = block.arguments ?? {};

    // Skip message tool — Discord/Slack sends are not interesting for logs
    if (toolName === "message") continue;

    // Format detail based on tool type
    let detail: string;
    switch (toolName) {
      case "exec":
        detail = `$ ${args.command ?? args.cmd ?? JSON.stringify(args).slice(0, 300)}`;
        break;
      case "read":
        detail = `Reading: ${args.file_path ?? args.path ?? JSON.stringify(args).slice(0, 300)}`;
        break;
      case "write":
        detail = `Writing: ${args.file_path ?? args.path ?? "?"}\n${(args.content ?? "").slice(0, 200)}`;
        break;
      case "memory_search":
        detail = `Query: ${args.query ?? JSON.stringify(args).slice(0, 300)}`;
        break;
      case "memory_get":
        detail = `Key: ${args.key ?? args.id ?? JSON.stringify(args).slice(0, 300)}`;
        break;
      default:
        detail = JSON.stringify(args).slice(0, 400);
    }

    enqueue({
      agent,
      toolName,
      detail,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });
  }
}

// --- Watch loop ---
const states: AgentState[] = AGENT_NAMES.map((agent) => ({
  agent,
  sessionDir: getSessionDir(agent),
  currentFile: null,
  fileOffset: 0,
}));

console.log("[openclaw-watcher] Starting...");
console.log(`[openclaw-watcher] Agents: ${AGENT_NAMES.join(", ")}`);

// Initialize: find latest session for each agent, seek to end
for (const state of states) {
  const latest = findLatestJsonl(state.sessionDir);
  if (latest) {
    state.currentFile = latest;
    // Start from end of file (only watch NEW events)
    try {
      state.fileOffset = statSync(join(state.sessionDir, latest)).size;
    } catch {
      state.fileOffset = 0;
    }
    console.log(`[openclaw-watcher] ${state.agent}: watching ${latest} (offset: ${state.fileOffset})`);
  } else {
    console.log(`[openclaw-watcher] ${state.agent}: no session found at ${state.sessionDir}`);
  }
}

// Watch for changes
for (const state of states) {
  if (!existsSync(state.sessionDir)) {
    console.log(`[openclaw-watcher] ${state.agent}: session dir not found, skipping`);
    continue;
  }

  watch(state.sessionDir, (eventType, filename) => {
    if (!filename?.endsWith(".jsonl") || filename === "sessions.json") return;

    // New session file appeared
    if (filename !== state.currentFile) {
      state.currentFile = filename;
      state.fileOffset = 0;
      console.log(`[openclaw-watcher] ${state.agent}: new session ${filename}`);
    }

    processNewLines(state);
  });
}

console.log("[openclaw-watcher] Watching for new tool calls...");

// Keep alive
setInterval(() => {}, 60_000);

// Flush on exit
process.on("SIGINT", async () => {
  await flush();
  process.exit(0);
});
