/**
 * CLAW KOSHIEN 2026 — Live Dashboard (Narration Edition)
 *
 * Real-time agent activity dashboard with LLM-powered Japanese commentary.
 * Translates raw tool calls into natural, engaging narration — like a
 * sports commentator for AI agents.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... \
 *   DISCORD_BOT_TOKEN=xxx \
 *   DISCORD_CHANNEL_ID=1480432438625697852 \
 *   bun run broadcast/live-dashboard.ts
 *
 * Opens on port 9003. Falls back to template-based narration without API key.
 * Discord reading is optional — enables external agents (e.g. murAI) via log channel.
 */

import { watch, readFileSync, statSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";

const PORT = 9003;
const HOME = homedir();
const IDLE_THRESHOLD_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;
const MAX_ACTIVITY = 30;
const NARRATION_COOLDOWN_MS = 3_000; // Min 3s between LLM calls per agent
const NARRATION_BATCH_THRESHOLD = 5; // Force narration after 5 accumulated actions
const MAX_NARRATION_HISTORY = 20;
const MAX_COMMENTARY = 50;
const MAX_CONCURRENT_LLM = 10;

// --- Agent metadata ---
const AGENTS: Record<
  string,
  { name: string; alias: string; color: string; role: string }
> = {
  ceo: { name: "CEO", alias: "Genie", color: "#5cf89a", role: "Chief Executive" },
  cmo: { name: "CMO", alias: "Aika", color: "#f0c040", role: "Chief Marketing" },
  coo: { name: "COO", alias: "Elon", color: "#40b0f0", role: "Chief Operations" },
  cto: { name: "CTO", alias: "Steve", color: "#c080f0", role: "Chief Technology" },
  cfo: { name: "CFO", alias: "Buffett", color: "#f08060", role: "Chief Financial" },
  murai: { name: "murAI", alias: "murAI", color: "#ff6b9d", role: "External Agent" },
  kento: { name: "KENTO", alias: "kento", color: "#e0e0e0", role: "Human Operator" },
};

const AGENT_NAMES = Object.keys(AGENTS);

// --- Domain name mapping for natural narration ---
const DOMAIN_NAMES: Record<string, string> = {
  "ryukyushimpo.jp": "琉球新報",
  "okinawatimes.co.jp": "沖縄タイムス",
  "nikkei.com": "日経新聞",
  "comemo.nikkei.com": "日経COMEMO",
  "forbesjapan.com": "Forbes Japan",
  "toyokeizai.net": "東洋経済",
  "diamond.jp": "ダイヤモンド・オンライン",
  "newspicks.com": "NewsPicks",
  "duckduckgo.com": "DuckDuckGo",
  "google.com": "Google",
  "github.com": "GitHub",
  "notion.so": "Notion",
  "slack.com": "Slack",
  "discord.com": "Discord",
  "twitter.com": "X (Twitter)",
  "x.com": "X",
  "wikipedia.org": "Wikipedia",
  "ja.wikipedia.org": "Wikipedia日本語版",
  "en.wikipedia.org": "Wikipedia英語版",
  "pref.okinawa.jp": "沖縄県公式サイト",
  "city.naha.okinawa.jp": "那覇市公式サイト",
  "stat.go.jp": "総務省統計局",
  "mlit.go.jp": "国土交通省",
  "jnto.go.jp": "日本政府観光局",
  "tripadvisor.com": "トリップアドバイザー",
  "booking.com": "Booking.com",
  "airbnb.com": "Airbnb",
  "reddit.com": "Reddit",
  "youtube.com": "YouTube",
  "anthropic.com": "Anthropic",
  "openai.com": "OpenAI",
  "arxiv.org": "arXiv",
};

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    // Try to extract domain-like pattern
    const match = url.match(/([a-z0-9-]+\.[a-z]{2,})/i);
    return match?.[1] ?? "";
  }
}

function domainToName(domain: string): string {
  // Exact match
  if (DOMAIN_NAMES[domain]) return DOMAIN_NAMES[domain];
  // Try parent domain (sub.example.com -> example.com)
  const parts = domain.split(".");
  if (parts.length > 2) {
    const parent = parts.slice(-2).join(".");
    if (DOMAIN_NAMES[parent]) return DOMAIN_NAMES[parent];
  }
  // Try partial match
  for (const [key, name] of Object.entries(DOMAIN_NAMES)) {
    if (domain.includes(key) || key.includes(domain)) return name;
  }
  // Fallback: use domain itself but prettify
  return domain || "ウェブサイト";
}

// --- Per-agent state ---
interface PendingAction {
  toolName: string;
  detail: string;
  timestamp: string;
}

interface NarrationEntry {
  timestamp: string;
  text: string;
}

interface AgentDashState {
  status: "working" | "thinking" | "idle" | "error";
  narration: string | null;
  narrationHistory: NarrationEntry[];
  pendingActions: PendingAction[];
  lastNarrationTime: number;
  lastTask: string | null;
  toolCallCount: number;
  tokenCount: number;
  sessionStart: string | null;
  lastUpdate: string;
  modelId: string | null;
  errorMessage: string | null;
}

interface CommentaryEntry {
  timestamp: string;
  agent: string;
  agentAlias: string;
  agentColor: string;
  text: string;
}

interface FileTracker {
  sessionDir: string;
  currentFile: string | null;
  fileOffset: number;
}

const agentStates: Record<string, AgentDashState> = {};
const fileTrackers: Record<string, FileTracker> = {};
const commentary: CommentaryEntry[] = [];
let activeLlmCalls = 0;

for (const agent of AGENT_NAMES) {
  agentStates[agent] = {
    status: "idle",
    narration: null,
    narrationHistory: [],
    pendingActions: [],
    lastNarrationTime: 0,
    lastTask: null,
    toolCallCount: 0,
    tokenCount: 0,
    sessionStart: null,
    lastUpdate: new Date().toISOString(),
    modelId: null,
    errorMessage: null,
  };
  fileTrackers[agent] = {
    sessionDir: resolve(HOME, `.openclaw-${agent}`, "agents", agent, "sessions"),
    currentFile: null,
    fileOffset: 0,
  };
}

// --- JSONL parsing ---
function findLatestJsonl(dir: string): string | null {
  if (!existsSync(dir)) return null;
  try {
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith(".jsonl") && f !== "sessions.json")
      .map((f: string) => ({
        name: f,
        mtime: statSync(join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files[0]?.name ?? null;
  } catch {
    return null;
  }
}

function formatToolDetail(toolName: string, args: any): string {
  switch (toolName) {
    case "exec":
    case "Bash":
      return args.command ?? args.cmd ?? JSON.stringify(args).slice(0, 200);
    case "read":
    case "Read":
      return args.file_path ?? args.path ?? JSON.stringify(args).slice(0, 200);
    case "write":
    case "Write":
      return args.file_path ?? args.path ?? "";
    case "Edit":
      return args.file_path ?? args.path ?? "";
    case "Glob":
      return args.pattern ?? JSON.stringify(args).slice(0, 200);
    case "Grep":
      return `${args.pattern ?? ""} in ${args.path ?? "."}`;
    case "web_search":
      return args.query ?? JSON.stringify(args).slice(0, 200);
    case "web_fetch":
      return args.url ?? JSON.stringify(args).slice(0, 200);
    case "memory_search":
      return args.query ?? JSON.stringify(args).slice(0, 200);
    case "memory_get":
      return args.key ?? args.id ?? JSON.stringify(args).slice(0, 200);
    case "message":
      return args.content ?? args.text ?? JSON.stringify(args).slice(0, 200);
    default:
      return JSON.stringify(args).slice(0, 200);
  }
}

function processEntry(agent: string, entry: any): boolean {
  const state = agentStates[agent];
  let changed = false;

  if (entry.type === "session") {
    state.sessionStart = entry.timestamp ?? new Date().toISOString();
    state.pendingActions = [];
    state.narration = null;
    state.narrationHistory = [];
    state.tokenCount = 0;
    state.toolCallCount = 0;
    state.errorMessage = null;
    state.lastUpdate = new Date().toISOString();
    changed = true;
  }

  if (entry.type === "model_change") {
    state.modelId = entry.modelId ?? null;
    state.lastUpdate = new Date().toISOString();
    changed = true;
  }

  if (entry.type !== "message") return changed;
  const msg = entry.message;
  if (!msg) return changed;

  // Track user tasks
  if (msg.role === "user") {
    const textContent = (msg.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join(" ");
    if (textContent) {
      state.lastTask = textContent.slice(0, 300);
      state.status = "thinking";
      state.lastUpdate = new Date().toISOString();
      changed = true;
    }
  }

  // Track assistant responses
  if (msg.role === "assistant") {
    if (msg.stopReason === "error" && msg.errorMessage) {
      state.status = "error";
      state.errorMessage = msg.errorMessage;
      state.lastUpdate = new Date().toISOString();
      return true;
    }

    if (msg.usage) {
      state.tokenCount +=
        (msg.usage.inputTokens ?? 0) + (msg.usage.outputTokens ?? 0);
      changed = true;
    }

    let hasToolCall = false;
    for (const block of msg.content ?? []) {
      if (block.type === "toolCall") {
        const toolName = block.name ?? "unknown";
        const args = block.arguments ?? {};
        const detail = formatToolDetail(toolName, args);

        // Skip noise: sleep, heartbeat checks, empty commands
        const lowerDetail = detail.toLowerCase();
        if (
          lowerDetail.startsWith("sleep ") ||
          lowerDetail.includes("heartbeat") ||
          toolName === "message" // Discord/Slack sends are noise for viewer
        ) {
          continue;
        }

        hasToolCall = true;

        state.status = "working";
        state.toolCallCount++;
        state.lastUpdate = new Date().toISOString();

        // Buffer the action for narration
        state.pendingActions.push({
          toolName,
          detail,
          timestamp: entry.timestamp ?? new Date().toISOString(),
        });

        changed = true;
      }

      if (block.type === "text" && block.text) {
        state.status = "thinking";
        state.lastUpdate = new Date().toISOString();
        changed = true;
      }
    }

    if (!hasToolCall && msg.content?.length) {
      state.status = "thinking";
      state.lastUpdate = new Date().toISOString();
      changed = true;
    }
  }

  return changed;
}

function processNewLines(agent: string): boolean {
  const tracker = fileTrackers[agent];
  if (!tracker.currentFile) return false;
  const filePath = join(tracker.sessionDir, tracker.currentFile);

  let anyChange = false;
  try {
    const stat = statSync(filePath);
    if (stat.size <= tracker.fileOffset) return false;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    let currentPos = 0;
    for (const line of lines) {
      const lineEnd = currentPos + Buffer.byteLength(line + "\n", "utf-8");
      if (currentPos >= tracker.fileOffset) {
        try {
          const entry = JSON.parse(line);
          if (processEntry(agent, entry)) anyChange = true;
        } catch {
          // Skip malformed
        }
      }
      currentPos = lineEnd;
    }

    tracker.fileOffset = stat.size;
  } catch {
    // File locked or gone
  }
  return anyChange;
}

// --- LLM Narration ---
function buildNarrationPrompt(agent: string, actions: PendingAction[]): string {
  const meta = AGENTS[agent];
  const actionLines = actions
    .map(
      (a) =>
        `- tool: ${a.toolName}, detail: ${a.detail.slice(0, 300)}`
    )
    .join("\n");

  return `あなたはAIエージェント甲子園のライブ実況者です。
エージェントの技術的なアクション（tool call）を、一般の視聴者にもわかる自然な日本語で実況してください。

ルール:
- tool名（web_fetch, exec, Read, Write, Bash, Grep, Glob等）は絶対に使わない。「調べている」「読んでいる」「書いている」等の自然な動詞を使う
- URLが含まれる場合、ドメインからメディア名やサイト名を推測して使う（例: ryukyushimpo.jp → 琉球新報）
- ファイルパスが含まれる場合、内容を推測して自然に言い換える（例: /report/okinawa.md → 沖縄レポート）
- 1-2文で簡潔に。スポーツ実況のようなテンポで
- エージェントの個性を活かす（CEO=リーダー的, CMO=マーケ視点, CTO=技術的アプローチ, COO=効率重視, CFO=数字に強い）
- 「！」を適度に使ってライブ感を出す

エージェント: ${meta.name} (${meta.alias}) — ${meta.role}
最近のアクション:
${actionLines}

実況コメント（日本語、1-2文）:`;
}

async function generateNarration(
  agent: string,
  actions: PendingAction[]
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackNarration(agent, actions);

  if (activeLlmCalls >= MAX_CONCURRENT_LLM) {
    return fallbackNarration(agent, actions);
  }

  activeLlmCalls++;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: buildNarrationPrompt(agent, actions),
          },
        ],
      }),
    });

    if (!resp.ok) {
      console.error(
        `[narration] API error for ${agent}: ${resp.status} ${resp.statusText}`
      );
      return fallbackNarration(agent, actions);
    }

    const data = (await resp.json()) as any;
    const text =
      data.content?.[0]?.text?.trim() ?? fallbackNarration(agent, actions);
    return text;
  } catch (err) {
    console.error(`[narration] Fetch error for ${agent}:`, err);
    return fallbackNarration(agent, actions);
  } finally {
    activeLlmCalls--;
  }
}

function describeAction(action: PendingAction): string {
  const t = action.toolName;
  const d = action.detail;

  if (t === "web_fetch" || t.includes("fetch")) {
    const domain = extractDomain(d);
    const siteName = domainToName(domain);
    return `${siteName}の記事をチェック中`;
  }
  if (t === "web_search") {
    const query = d.replace(/^Query:\s*/i, "").slice(0, 30);
    return `「${query}」をウェブで調査中`;
  }
  if (t === "memory_search" || t === "memory_get" || t.includes("memory")) {
    const query = d.replace(/^(Query|Key):\s*/i, "").slice(0, 30);
    return query ? `「${query}」について記憶を探索中` : `過去の情報を掘り起こし中`;
  }
  if (t === "message") {
    return `チームに報告を送信中`;
  }
  if (t === "read" || t === "Read") {
    const filename = d.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    return filename ? `「${filename}」を読み込み中` : `資料に目を通し中`;
  }
  if (t === "exec" || t === "Bash") {
    if (d.includes("grep") || d.includes("rg")) return `ファイルの中身を検索中`;
    if (d.includes("cd") || d.includes("ls")) return `ワークスペースを確認中`;
    if (d.includes("mkdir")) return `作業環境を準備中`;
    return `システムコマンドを実行中`;
  }
  if (t === "write" || t === "Write" || t === "Edit") {
    const filename = d.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    return filename ? `「${filename}」を編集中` : `ドキュメントを作成中`;
  }
  if (t === "Glob" || t === "Grep") return `必要なファイルを探索中`;
  if (t.includes("slack")) return `Slackで連携中`;
  if (t.includes("notion")) return `Notionのデータを操作中`;
  if (t.includes("github")) return `GitHubのコードを確認中`;
  if (t.includes("qdrant")) return `ナレッジベースから知識を引き出し中`;
  if (t.includes("browser")) return `ブラウザで情報を確認中`;
  return `作業を進めている`;
}

function fallbackNarration(agent: string, actions: PendingAction[]): string {
  const alias = AGENTS[agent].alias;
  if (actions.length === 0) return `${alias}が作業を進めている。`;

  // Focus on the most recent 1-2 actions (not a full dump)
  const recent = actions.slice(-2);
  const descriptions = [...new Set(recent.map(describeAction))];

  if (descriptions.length === 1) {
    return `${alias}が${descriptions[0]}！`;
  }
  return `${alias}が${descriptions[0]}。さらに${descriptions[1]}！`;
}

// Narration scheduling: check if any agent needs narration
async function checkAndGenerateNarrations(): Promise<void> {
  const now = Date.now();
  for (const agent of AGENT_NAMES) {
    const state = agentStates[agent];
    if (state.pendingActions.length === 0) continue;

    const timeSinceLastNarration = now - state.lastNarrationTime;
    const shouldNarrate =
      (state.pendingActions.length > 0 &&
        timeSinceLastNarration >= NARRATION_COOLDOWN_MS) ||
      state.pendingActions.length >= NARRATION_BATCH_THRESHOLD;

    if (shouldNarrate) {
      const actions = [...state.pendingActions];
      state.pendingActions = [];
      state.lastNarrationTime = now;

      // Generate narration (don't await — fire and forget, but handle result)
      generateNarration(agent, actions).then((text) => {
        const entry: NarrationEntry = {
          timestamp: new Date().toISOString(),
          text,
        };
        state.narration = text;
        state.narrationHistory.unshift(entry);
        if (state.narrationHistory.length > MAX_NARRATION_HISTORY) {
          state.narrationHistory = state.narrationHistory.slice(
            0,
            MAX_NARRATION_HISTORY
          );
        }

        // Add to global commentary
        const meta = AGENTS[agent];
        commentary.unshift({
          timestamp: entry.timestamp,
          agent,
          agentAlias: meta.alias,
          agentColor: meta.color,
          text,
        });
        if (commentary.length > MAX_COMMENTARY) {
          commentary.length = MAX_COMMENTARY;
        }

        // Broadcast the update
        broadcastFullState();
      });
    }
  }
}

// Run narration checks every 2 seconds
setInterval(checkAndGenerateNarrations, 2_000);

// --- Idle detection ---
setInterval(() => {
  const now = Date.now();
  let anyChange = false;
  for (const agent of AGENT_NAMES) {
    const state = agentStates[agent];
    if (
      state.status !== "idle" &&
      state.status !== "error" &&
      now - new Date(state.lastUpdate).getTime() > IDLE_THRESHOLD_MS
    ) {
      state.status = "idle";
      // Keep last narration as-is (don't overwrite with "待機中")
      anyChange = true;
    }
  }
  if (anyChange) broadcastFullState();
}, 5_000);

// --- Discord log channel reader ---
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const DISCORD_CHANNEL_ID =
  process.env.DISCORD_CHANNEL_ID ?? "1480432438625697852";
let lastDiscordMessageId: string | null = null;

// Map embed footer text (agent name) to our agent keys
function resolveDiscordAgent(footerText: string): string {
  const lower = footerText.toLowerCase().trim();
  // Direct match on agent keys
  if (AGENTS[lower]) return lower;
  // Match on alias
  for (const [key, meta] of Object.entries(AGENTS)) {
    if (meta.alias.toLowerCase() === lower) return key;
    if (meta.name.toLowerCase() === lower) return key;
  }
  // Fuzzy: "murai" variants
  if (lower.includes("murai") || lower.includes("mur")) return "murai";
  // Unknown agent — dynamically register it
  const safeKey = lower.replace(/[^a-z0-9]/g, "_");
  if (!AGENTS[safeKey]) {
    AGENTS[safeKey] = {
      name: footerText.toUpperCase(),
      alias: footerText,
      color: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"),
      role: "External Agent",
    };
    AGENT_NAMES.push(safeKey);
    agentStates[safeKey] = {
      status: "idle",
      narration: null,
      narrationHistory: [],
      pendingActions: [],
      lastNarrationTime: 0,
      lastTask: null,
      toolCallCount: 0,
      tokenCount: 0,
      sessionStart: null,
      lastUpdate: new Date().toISOString(),
      modelId: null,
      errorMessage: null,
    };
    console.log(`[discord] Discovered new agent: ${footerText} → ${safeKey}`);
  }
  return safeKey;
}

// Parse a Discord embed (from openclaw-watcher format) into a PendingAction
function parseDiscordEmbed(embed: any): { agent: string; action: PendingAction } | null {
  const footer = embed.footer?.text;
  if (!footer) return null;

  const agent = resolveDiscordAgent(footer);
  const title = embed.title ?? "";
  const description = embed.description ?? "";

  // title format: "icon toolName" — extract tool name
  const toolMatch = title.replace(/^[\p{Emoji}\s]+/u, "").trim();
  const toolName = toolMatch || "unknown";

  return {
    agent,
    action: {
      toolName,
      detail: description,
      timestamp: embed.timestamp ?? new Date().toISOString(),
    },
  };
}

async function pollDiscordChannel(): Promise<void> {
  if (!DISCORD_BOT_TOKEN) return;

  try {
    const url = lastDiscordMessageId
      ? `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?after=${lastDiscordMessageId}&limit=20`
      : `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=10`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        // Rate limited — back off
        const retryAfter = Number(resp.headers.get("retry-after") ?? "5");
        console.warn(`[discord] Rate limited, retrying in ${retryAfter}s`);
        return;
      }
      console.error(`[discord] API error: ${resp.status}`);
      return;
    }

    const messages: any[] = await resp.json();
    if (!messages.length) return;

    // Messages come newest-first; reverse for chronological processing
    const sorted = [...messages].reverse();

    let anyChange = false;
    for (const msg of sorted) {
      // Update cursor
      if (!lastDiscordMessageId || msg.id > lastDiscordMessageId) {
        lastDiscordMessageId = msg.id;
      }

      // Process embeds (openclaw-watcher format)
      for (const embed of msg.embeds ?? []) {
        const parsed = parseDiscordEmbed(embed);
        if (!parsed) continue;

        const state = agentStates[parsed.agent];
        if (!state) continue;

        state.status = "working";
        state.toolCallCount++;
        state.lastUpdate = new Date().toISOString();
        if (!state.sessionStart) state.sessionStart = parsed.action.timestamp;

        state.pendingActions.push(parsed.action);
        anyChange = true;
      }
    }

    if (anyChange) broadcastFullState();
  } catch (err) {
    console.error("[discord] Poll error:", err);
  }
}

// Poll Discord every 3 seconds if token is available
if (DISCORD_BOT_TOKEN) {
  console.log(`[live-dashboard] Discord log channel: ENABLED (channel ${DISCORD_CHANNEL_ID})`);
  // Initial fetch — get last 10 messages to hydrate
  pollDiscordChannel();
  setInterval(pollDiscordChannel, 3_000);
} else {
  console.log("[live-dashboard] Discord log channel: DISABLED (no DISCORD_BOT_TOKEN)");
}

// --- Serialize state for broadcast ---
function serializeState(): object {
  const agents: Record<string, any> = {};
  for (const agent of AGENT_NAMES) {
    const s = agentStates[agent];
    agents[agent] = {
      ...AGENTS[agent],
      status: s.status,
      narration: s.narration,
      narrationHistory: s.narrationHistory.slice(0, MAX_NARRATION_HISTORY),
      toolCallCount: s.toolCallCount,
      tokenCount: s.tokenCount,
      sessionStart: s.sessionStart,
      lastUpdate: s.lastUpdate,
      lastTask: s.lastTask,
      errorMessage: s.errorMessage,
    };
  }
  return {
    type: "state",
    agents,
    commentary: commentary.slice(0, 30),
    serverTime: new Date().toISOString(),
  };
}

// --- WebSocket management ---
const wsClients = new Set<any>();

function broadcastFullState(): void {
  const payload = JSON.stringify(serializeState());
  for (const ws of wsClients) {
    try {
      ws.send(payload);
    } catch {
      wsClients.delete(ws);
    }
  }
}

function broadcastAgentUpdate(agent: string): void {
  // For simplicity and to keep commentary in sync, broadcast full state
  broadcastFullState();
}

// --- Initialize watchers ---
console.log("[live-dashboard] Starting CLAW KOSHIEN 2026 Live Dashboard (Narration Edition)...");
console.log(`[live-dashboard] Agents: ${AGENT_NAMES.join(", ")}`);
console.log(
  `[live-dashboard] LLM narration: ${process.env.ANTHROPIC_API_KEY ? "ENABLED (Claude Haiku)" : "DISABLED (template fallback)"}`
);

for (const agent of AGENT_NAMES) {
  const tracker = fileTrackers[agent];
  const latest = findLatestJsonl(tracker.sessionDir);
  if (latest) {
    tracker.currentFile = latest;
    tracker.fileOffset = 0;
    processNewLines(agent);
    console.log(
      `[live-dashboard] ${agent}: loaded ${latest} (${agentStates[agent].toolCallCount} tool calls, status: ${agentStates[agent].status})`
    );
  } else {
    console.log(
      `[live-dashboard] ${agent}: no session found at ${tracker.sessionDir}`
    );
  }
}

// Generate initial narrations for agents with existing activity
(async () => {
  for (const agent of AGENT_NAMES) {
    const state = agentStates[agent];
    if (state.pendingActions.length > 0) {
      const actions = [...state.pendingActions];
      state.pendingActions = [];
      state.lastNarrationTime = Date.now();
      try {
        const text = await generateNarration(agent, actions);
        state.narration = text;
        state.narrationHistory.unshift({
          timestamp: new Date().toISOString(),
          text,
        });
        const meta = AGENTS[agent];
        commentary.unshift({
          timestamp: new Date().toISOString(),
          agent,
          agentAlias: meta.alias,
          agentColor: meta.color,
          text,
        });
      } catch {
        // Silent — will generate on next activity
      }
    }
  }
  broadcastFullState();
})();

// fs.watch for each agent
for (const agent of AGENT_NAMES) {
  const tracker = fileTrackers[agent];
  if (!existsSync(tracker.sessionDir)) {
    console.log(`[live-dashboard] ${agent}: session dir not found, skipping`);
    continue;
  }

  watch(tracker.sessionDir, (_eventType, filename) => {
    if (!filename?.endsWith(".jsonl") || filename === "sessions.json") return;

    if (filename !== tracker.currentFile) {
      tracker.currentFile = filename;
      tracker.fileOffset = 0;
      console.log(`[live-dashboard] ${agent}: new session ${filename}`);
    }

    if (processNewLines(agent)) {
      broadcastAgentUpdate(agent);
    }
  });
}

// Periodic poll as backup
setInterval(() => {
  for (const agent of AGENT_NAMES) {
    if (processNewLines(agent)) {
      broadcastAgentUpdate(agent);
    }
  }
}, POLL_INTERVAL_MS);

// --- HTML Dashboard ---
const HTML = /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CLAW KOSHIEN 2026 — LIVE</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0d14;
    --bg-card: rgba(16, 20, 30, 0.85);
    --bg-card-hover: rgba(22, 28, 42, 0.95);
    --border: rgba(92, 248, 154, 0.10);
    --border-active: rgba(92, 248, 154, 0.35);
    --accent: #5cf89a;
    --text: #e8eaf0;
    --text-dim: #8b93a5;
    --text-muted: #3d4555;
    --radius: 18px;
    --radius-sm: 10px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Noto Sans JP', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Subtle grid background */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      linear-gradient(rgba(92, 248, 154, 0.012) 1px, transparent 1px),
      linear-gradient(90deg, rgba(92, 248, 154, 0.012) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }

  /* Ambient glow */
  body::after {
    content: '';
    position: fixed;
    top: -30%;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 50%;
    background: radial-gradient(ellipse, rgba(92, 248, 154, 0.03) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* ===== HEADER ===== */
  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 32px;
    background: rgba(10, 13, 20, 0.94);
    backdrop-filter: blur(24px);
    border-bottom: 1px solid var(--border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(92, 248, 154, 0.08);
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid rgba(92, 248, 154, 0.2);
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .live-text {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--accent);
    text-transform: uppercase;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px var(--accent), 0 0 10px var(--accent); opacity: 1; }
    50% { box-shadow: 0 0 8px var(--accent), 0 0 20px var(--accent); opacity: 0.6; }
  }

  .header-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1.5px;
    background: linear-gradient(135deg, var(--accent), #40e0d0, #80c0ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 13px;
    color: var(--text-dim);
  }

  .conn-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    transition: background 0.3s;
  }

  .conn-dot.disconnected {
    background: #ef4444;
    animation: pulse-red 1s ease-in-out infinite;
  }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 4px #ef4444; }
    50% { box-shadow: 0 0 12px #ef4444; }
  }

  .agent-count {
    font-weight: 700;
    font-size: 14px;
  }

  /* ===== COMMENTARY TICKER ===== */
  .ticker-container {
    position: relative;
    z-index: 10;
    overflow: hidden;
    background: rgba(10, 13, 20, 0.7);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0;
    height: 48px;
  }

  .ticker-label {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: linear-gradient(90deg, rgba(10, 13, 20, 0.98) 70%, transparent);
    z-index: 2;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--accent);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ticker-track {
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: 120px;
    animation: ticker-scroll 60s linear infinite;
    white-space: nowrap;
  }

  .ticker-track:hover {
    animation-play-state: paused;
  }

  @keyframes ticker-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 24px;
    font-size: 13px;
    flex-shrink: 0;
  }

  .ticker-agent {
    font-weight: 700;
    white-space: nowrap;
  }

  .ticker-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ticker-text {
    color: var(--text-dim);
    white-space: nowrap;
  }

  .ticker-sep {
    color: var(--text-muted);
    padding: 0 8px;
    font-size: 10px;
  }

  /* ===== AGENT GRID ===== */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 24px 32px;
    position: relative;
    z-index: 1;
  }

  @media (max-width: 1200px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; padding: 16px; gap: 14px; }
    .header { padding: 12px 16px; }
    .ticker-container { height: 40px; }
  }

  /* ===== AGENT CARD ===== */
  .agent-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    backdrop-filter: blur(10px);
    cursor: pointer;
    position: relative;
  }

  .agent-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
    transform: translateY(-2px);
  }

  .agent-card.active {
    border-color: var(--agent-color, var(--border-active));
    box-shadow:
      0 0 30px rgba(var(--agent-color-rgb, 92, 248, 154), 0.06),
      inset 0 1px 0 rgba(var(--agent-color-rgb, 92, 248, 154), 0.08);
    animation: card-glow 3s ease-in-out infinite;
  }

  @keyframes card-glow {
    0%, 100% {
      box-shadow:
        0 0 20px rgba(var(--agent-color-rgb, 92, 248, 154), 0.04),
        inset 0 1px 0 rgba(var(--agent-color-rgb, 92, 248, 154), 0.06);
    }
    50% {
      box-shadow:
        0 0 40px rgba(var(--agent-color-rgb, 92, 248, 154), 0.10),
        inset 0 1px 0 rgba(var(--agent-color-rgb, 92, 248, 154), 0.12);
    }
  }

  .agent-card.expanded {
    grid-column: 1 / -1;
  }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
  }

  .card-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .avatar-large {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: 0.5px;
    color: #0a0d14;
    position: relative;
    overflow: hidden;
  }

  .avatar-large::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
    border-radius: inherit;
  }

  .agent-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .agent-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }

  .agent-role {
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 500;
  }

  /* Status pill */
  .status-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .status-pill.working {
    background: rgba(92, 248, 154, 0.10);
    color: #5cf89a;
  }

  .status-pill.thinking {
    background: rgba(240, 192, 64, 0.10);
    color: #f0c040;
  }

  .status-pill.idle {
    background: rgba(107, 114, 128, 0.10);
    color: #6b7280;
  }

  .status-pill.error {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .status-dot.working {
    background: #5cf89a;
    animation: pulse-status 1.5s ease-in-out infinite;
  }

  .status-dot.thinking {
    background: #f0c040;
    animation: breathe 2.5s ease-in-out infinite;
  }

  .status-dot.idle {
    background: #4b5563;
  }

  .status-dot.error {
    background: #ef4444;
    animation: flash-error 0.6s ease-in-out infinite;
  }

  @keyframes pulse-status {
    0%, 100% { box-shadow: 0 0 4px #5cf89a, 0 0 10px #5cf89a; transform: scale(1); }
    50% { box-shadow: 0 0 8px #5cf89a, 0 0 20px #5cf89a; transform: scale(1.2); }
  }

  @keyframes breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  @keyframes flash-error {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ===== NARRATION BUBBLE (THE STAR) ===== */
  .narration-bubble {
    margin: 0 16px 12px;
    padding: 16px 20px;
    background: rgba(var(--agent-color-rgb, 92, 248, 154), 0.04);
    border: 1px solid rgba(var(--agent-color-rgb, 92, 248, 154), 0.10);
    border-radius: 16px;
    position: relative;
    min-height: 60px;
    display: flex;
    align-items: center;
    transition: all 0.3s ease;
  }

  /* Speech bubble triangle */
  .narration-bubble::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 32px;
    width: 16px;
    height: 16px;
    background: rgba(var(--agent-color-rgb, 92, 248, 154), 0.04);
    border-left: 1px solid rgba(var(--agent-color-rgb, 92, 248, 154), 0.10);
    border-top: 1px solid rgba(var(--agent-color-rgb, 92, 248, 154), 0.10);
    transform: rotate(45deg);
  }

  .narration-text {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text);
    font-weight: 500;
    letter-spacing: 0.2px;
  }

  .narration-text.placeholder {
    color: var(--text-muted);
    font-style: italic;
    font-size: 13px;
  }

  .narration-bubble.new-narration {
    animation: narration-fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes narration-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ===== CARD FOOTER ===== */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px 14px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .card-footer-stats {
    display: flex;
    gap: 16px;
  }

  .footer-stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .footer-stat-item .val {
    color: var(--text-dim);
    font-weight: 600;
  }

  .updated-ago {
    font-size: 11px;
    color: var(--text-muted);
  }

  /* ===== EXPANDED: NARRATION HISTORY ===== */
  .narration-history {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .agent-card.expanded .narration-history {
    max-height: 400px;
    overflow-y: auto;
  }

  .narration-history-inner {
    padding: 0 20px 16px;
  }

  .history-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 8px 0;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .history-item {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.02);
    animation: slide-in 0.3s ease;
  }

  @keyframes slide-in {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .history-time {
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
    width: 52px;
    padding-top: 2px;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .history-text {
    font-size: 13px;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .narration-history::-webkit-scrollbar { width: 4px; }
  .narration-history::-webkit-scrollbar-track { background: transparent; }
  .narration-history::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  /* ===== GLOBAL FOOTER ===== */
  .footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 20px 32px;
    border-top: 1px solid var(--border);
    background: rgba(10, 13, 20, 0.6);
    backdrop-filter: blur(12px);
  }

  .global-stat {
    text-align: center;
  }

  .global-stat-value {
    font-size: 26px;
    font-weight: 800;
    color: var(--accent);
    font-family: 'SF Mono', 'Fira Code', monospace;
    line-height: 1;
  }

  .global-stat-label {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-top: 4px;
    font-weight: 600;
  }

  /* ===== EMPTY TICKER ===== */
  .ticker-empty {
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: 120px;
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <div class="live-badge">
      <div class="live-dot"></div>
      <span class="live-text">Live</span>
    </div>
    <div class="header-title">CLAW KOSHIEN 2026</div>
  </div>
  <div class="header-right">
    <div class="conn-status">
      <div class="conn-dot" id="connDot"></div>
      <span id="connText">Connecting...</span>
    </div>
    <div class="agent-count" id="activeCount"></div>
  </div>
</header>

<div class="ticker-container">
  <div class="ticker-label">COMMENTARY</div>
  <div id="tickerTrack" class="ticker-empty">
    実況コメンタリーを待機中...
  </div>
</div>

<div class="grid" id="grid"></div>

<footer class="footer">
  <div class="global-stat">
    <div class="global-stat-value" id="totalToolCalls">0</div>
    <div class="global-stat-label">Actions</div>
  </div>
  <div class="global-stat">
    <div class="global-stat-value" id="totalActiveAgents">0</div>
    <div class="global-stat-label">Active</div>
  </div>
  <div class="global-stat">
    <div class="global-stat-value" id="totalNarrations">0</div>
    <div class="global-stat-label">Narrations</div>
  </div>
</footer>

<script>
// Dynamic: render all agents from server state (handles dynamically discovered agents)
let AGENT_ORDER = ['ceo', 'cmo', 'coo', 'cto', 'cfo', 'murai', 'kento'];
let agentData = {};
let commentaryData = [];
let expandedAgent = null;
let lastNarrations = {};

// --- WebSocket ---
let ws;
let reconnectTimer;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/ws');

  ws.onopen = () => {
    document.getElementById('connDot').classList.remove('disconnected');
    document.getElementById('connText').textContent = 'Connected';
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onclose = () => {
    document.getElementById('connDot').classList.add('disconnected');
    document.getElementById('connText').textContent = 'Reconnecting...';
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state') {
        agentData = msg.agents;
        commentaryData = msg.commentary || [];
        renderAll();
        renderTicker();
      }
    } catch {}
  };
}

// --- Helpers ---
function formatTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(start) {
  if (!start) return '--';
  const ms = Date.now() - new Date(start).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return 'たった今';
  if (s < 60) return s + '秒前';
  if (s < 3600) return Math.floor(s / 60) + '分前';
  return Math.floor(s / 3600) + '時間前';
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r + ',' + g + ',' + b;
}

// --- Commentary Ticker ---
function renderTicker() {
  const container = document.getElementById('tickerTrack');
  if (!commentaryData || commentaryData.length === 0) {
    container.className = 'ticker-empty';
    container.innerHTML = '\\u5B9F\\u6CC1\\u30B3\\u30E1\\u30F3\\u30BF\\u30EA\\u30FC\\u3092\\u5F85\\u6A5F\\u4E2D...';
    return;
  }

  container.className = 'ticker-track';

  // Build ticker items - duplicate for seamless scroll
  const items = commentaryData.slice(0, 10);
  const buildItems = (list) => list.map(c => {
    const rgb = hexToRgb(c.agentColor);
    return '<span class="ticker-item">' +
      '<span class="ticker-dot" style="background:' + c.agentColor + '"></span>' +
      '<span class="ticker-agent" style="color:' + c.agentColor + '">' + escapeHtml(c.agentAlias) + '</span>' +
      '<span class="ticker-text">' + escapeHtml(c.text) + '</span>' +
      '</span>' +
      '<span class="ticker-sep">|</span>';
  }).join('');

  // Duplicate content for infinite scroll
  container.innerHTML = buildItems(items) + buildItems(items);

  // Reset animation
  container.style.animation = 'none';
  container.offsetHeight; // Force reflow
  const duration = Math.max(30, items.length * 8);
  container.style.animation = 'ticker-scroll ' + duration + 's linear infinite';
}

// --- Agent Cards ---
function buildCard(agentId) {
  const a = agentData[agentId];
  if (!a) return '';
  const rgb = hexToRgb(a.color);
  const isActive = a.status === 'working' || a.status === 'thinking';
  const isExpanded = expandedAgent === agentId;

  // Determine narration text
  let narrationHtml;
  const isNew = lastNarrations[agentId] !== a.narration && a.narration;
  if (isNew) lastNarrations[agentId] = a.narration;

  if (a.narration) {
    narrationHtml = '<div class="narration-bubble' + (isNew ? ' new-narration' : '') + '" style="--agent-color-rgb:' + rgb + '">' +
      '<p class="narration-text">' + escapeHtml(a.narration) + '</p>' +
      '</div>';
  } else if (a.status === 'error' && a.errorMessage) {
    narrationHtml = '<div class="narration-bubble" style="--agent-color-rgb:239,68,68">' +
      '<p class="narration-text" style="color:#ef4444">\\u554F\\u984C\\u304C\\u767A\\u751F\\u3057\\u305F\\u3088\\u3046\\u3067\\u3059\\u3002\\u5FA9\\u65E7\\u3092\\u8A66\\u307F\\u3066\\u3044\\u307E\\u3059...</p>' +
      '</div>';
  } else {
    narrationHtml = '<div class="narration-bubble" style="--agent-color-rgb:' + rgb + '">' +
      '<p class="narration-text placeholder">\\u6D3B\\u52D5\\u3092\\u5F85\\u6A5F\\u4E2D...</p>' +
      '</div>';
  }

  // Status text mapping
  const statusLabels = {
    working: 'ACTIVE',
    thinking: 'THINKING',
    idle: 'IDLE',
    error: 'ERROR'
  };

  // Narration history for expanded view
  let historyHtml = '';
  if (a.narrationHistory && a.narrationHistory.length > 0) {
    const historyItems = a.narrationHistory.map(h =>
      '<div class="history-item">' +
        '<span class="history-time">' + formatTime(h.timestamp) + '</span>' +
        '<span class="history-text">' + escapeHtml(h.text) + '</span>' +
      '</div>'
    ).join('');

    historyHtml = '<div class="narration-history">' +
      '<div class="narration-history-inner">' +
        '<div class="history-label">Narration History</div>' +
        historyItems +
      '</div>' +
    '</div>';
  }

  return '<div class="agent-card ' + (isActive ? 'active' : '') + ' ' + (isExpanded ? 'expanded' : '') + '"' +
    ' style="--agent-color:' + a.color + '; --agent-color-rgb:' + rgb + '"' +
    ' id="card-' + agentId + '" onclick="toggleExpand(\\'' + agentId + '\\')">' +

    '<div class="card-header">' +
      '<div class="card-header-left">' +
        '<div class="avatar-large" style="background:' + a.color + '">' + a.name + '</div>' +
        '<div class="agent-info">' +
          '<div class="agent-name" style="color:' + a.color + '">' + a.alias + '</div>' +
          '<div class="agent-role">' + a.role + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="status-pill ' + a.status + '">' +
        '<div class="status-dot ' + a.status + '"></div>' +
        statusLabels[a.status] +
      '</div>' +
    '</div>' +

    narrationHtml +

    '<div class="card-footer">' +
      '<div class="card-footer-stats">' +
        '<span class="footer-stat-item">\\u{1F527} <span class="val">' + (a.toolCallCount || 0) + '</span> actions</span>' +
        '<span class="footer-stat-item">\\u{23F1}\\u{FE0F} <span class="val">' + formatDuration(a.sessionStart) + '</span></span>' +
      '</div>' +
      '<span class="updated-ago">' + timeAgo(a.lastUpdate) + '</span>' +
    '</div>' +

    historyHtml +

  '</div>';
}

function renderAll() {
  // Discover agents from server data that aren't in AGENT_ORDER yet
  for (const id of Object.keys(agentData)) {
    if (!AGENT_ORDER.includes(id)) AGENT_ORDER.push(id);
  }
  const grid = document.getElementById('grid');
  grid.innerHTML = AGENT_ORDER.filter(id => agentData[id]).map(id => buildCard(id)).join('');
  updateFooter();
}

function toggleExpand(agentId) {
  expandedAgent = expandedAgent === agentId ? null : agentId;
  renderAll();
  renderTicker();
}

function updateFooter() {
  let totalCalls = 0, activeCount = 0, totalNarrations = 0;
  for (const id of AGENT_ORDER) {
    const a = agentData[id];
    if (!a) continue;
    totalCalls += a.toolCallCount || 0;
    if (a.status === 'working' || a.status === 'thinking') activeCount++;
    totalNarrations += (a.narrationHistory || []).length;
  }
  document.getElementById('totalToolCalls').textContent = totalCalls;
  document.getElementById('totalActiveAgents').textContent = activeCount;
  document.getElementById('totalNarrations').textContent = totalNarrations;
  document.getElementById('activeCount').textContent = activeCount + '\\u{1F916} Active';
}

// Refresh "updated X ago" every 5s
setInterval(() => {
  for (const id of AGENT_ORDER) {
    const el = document.getElementById('card-' + id);
    if (!el) continue;
    const upd = el.querySelector('.updated-ago');
    if (upd && agentData[id]) {
      upd.textContent = timeAgo(agentData[id].lastUpdate);
    }
  }
}, 5000);

connect();
</script>
</body>
</html>`;

// --- Bun Server ---
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Serve HTML dashboard
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        llmEnabled: !!process.env.ANTHROPIC_API_KEY,
        agents: AGENT_NAMES.map((a) => ({
          name: a,
          status: agentStates[a].status,
          toolCalls: agentStates[a].toolCallCount,
          narration: agentStates[a].narration,
        })),
        commentaryCount: commentary.length,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
      ws.send(JSON.stringify(serializeState()));
    },
    close(ws) {
      wsClients.delete(ws);
    },
    message(_ws, _msg) {
      // No client->server messages needed
    },
  },
});

console.log(`[live-dashboard] Dashboard running at http://localhost:${PORT}`);
console.log("[live-dashboard] Watching for agent activity...");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[live-dashboard] Shutting down...");
  server.stop();
  process.exit(0);
});
