/**
 * Bun HTTP server that reads OpenClaw agent session files
 * and serves parsed state as JSON for the 3D viewer.
 *
 * GET /agent/:name -> { status, tool, summary, lastTask, recentTools }
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PORT = 9002;
const AGENTS_DIR = join(import.meta.dir, '../../agents');
const STALE_THRESHOLD_S = 120;

interface ToolEntry {
  name: string;
  timestamp: string;
}

interface AgentState {
  status: 'thinking' | 'working' | 'idle';
  tool: string;
  summary: string;
  lastTask: string;
  recentTools: ToolEntry[];
}

function cleanLastTask(raw: string): string {
  let t = raw.trim();
  if (!t) return '';

  // Remove "System: " prefix
  t = t.replace(/^System:\s*/i, '');

  // Remove timestamp prefix like [2026-03-04 15:41:08 UTC]
  t = t.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*\w*\]\s*/, '');

  // Detect Slack message pattern and summarize
  const slackMatch = t.match(/Slack message in #(\S+) from (\S+?):\s*(.*)/i);
  if (slackMatch) {
    const channel = slackMatch[1];
    const user = slackMatch[2];
    const msg = slackMatch[3].replace(/<@\w+>\s*/, '').trim();
    const preview = msg.length > 60 ? msg.slice(0, 60) + '...' : msg;
    return `Slack\u3067\u6307\u793A\u3092\u53D7\u4FE1 (#${channel}) ${preview}`;
  }

  // Remove Read HEARTBEAT patterns
  if (t.startsWith('Read HEARTBEAT') || t === 'HEARTBEAT_OK') return '';

  // Truncate
  return t.length > 120 ? t.slice(0, 120) + '...' : t;
}

const EMPTY_STATE: AgentState = {
  status: 'idle', tool: '', summary: '', lastTask: '', recentTools: [],
};

async function getRecentSessions(agentName: string, count = 3): Promise<string[]> {
  const sessDir = join(AGENTS_DIR, agentName, 'sessions');
  try {
    const files = await readdir(sessDir);
    const jsonls = files.filter(f => f.endsWith('.jsonl'));
    if (jsonls.length === 0) return [];

    const withMtime: Array<{ path: string; mtime: number }> = [];
    for (const f of jsonls) {
      const fpath = join(sessDir, f);
      const s = await stat(fpath);
      withMtime.push({ path: fpath, mtime: s.mtimeMs });
    }
    withMtime.sort((a, b) => b.mtime - a.mtime);
    return withMtime.slice(0, count).map(x => x.path);
  } catch {
    return [];
  }
}

async function parseSessions(filePaths: string[]): Promise<AgentState> {
  if (filePaths.length === 0) return { ...EMPTY_STATE };

  // Collect lines from all sessions (newest first, but read oldest-first for chronological order)
  let allLines: string[] = [];
  for (const fp of [...filePaths].reverse()) {
    const file = Bun.file(fp);
    const text = await file.text();
    allLines = allLines.concat(text.trim().split('\n'));
  }

  // Freshness based on newest session
  const fstat = await stat(filePaths[0]);
  const ageS = (Date.now() - fstat.mtimeMs) / 1000;
  const isStale = ageS > STALE_THRESHOLD_S;

  const lines = allLines;

  const recent = lines;
  let lastTool = '';
  let lastText = '';
  let lastTask = '';
  let hasThinking = false;
  const recentTools: ToolEntry[] = [];

  for (const line of recent) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'message') continue;
      const msg = entry.message;
      if (!msg?.content || !Array.isArray(msg.content)) continue;

      const ts = entry.timestamp || '';

      if (msg.role === 'user') {
        for (const c of msg.content) {
          if (c.type === 'text' && c.text) {
            // Skip heartbeat system prompts, get real task
            const t = c.text.trim();
            if (!t.startsWith('Read HEARTBEAT') && t.length > 5) {
              lastTask = t;
            }
          }
        }
      }

      if (msg.role === 'assistant') {
        for (const c of msg.content) {
          const toolName = (c.type === 'toolCall' && c.name) || (c.type === 'tool_use' && c.name);
          if (toolName) {
            lastTool = toolName;
            recentTools.push({
              name: toolName,
              timestamp: ts ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '',
            });
          }
          if (c.type === 'thinking') {
            hasThinking = true;
          }
          if (c.type === 'text' && c.text) {
            const cleaned = c.text.replace(/\[\[.*?\]\]\s*/g, '').trim();
            if (cleaned && cleaned !== 'HEARTBEAT_OK') lastText = cleaned;
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Keep last 10 tools
  const tools = recentTools.slice(-10);
  const taskPreview = cleanLastTask(lastTask);

  if (isStale) {
    const summary = lastText.length > 80 ? lastText.slice(0, 80) + '...' : lastText;
    const agoMin = Math.floor(ageS / 60);
    return {
      status: 'idle',
      tool: '',
      summary: summary ? `[${agoMin}m ago] ${summary}` : '',
      lastTask: taskPreview,
      recentTools: tools,
    };
  }

  const status: AgentState['status'] = lastTool ? 'working' : hasThinking ? 'thinking' : 'idle';
  const summary = lastText.length > 80 ? lastText.slice(0, 80) + '...' : lastText;

  return { status, tool: lastTool, summary, lastTask: taskPreview, recentTools: tools };
}

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const match = url.pathname.match(/^\/agent\/(\w+)$/);
    if (match) {
      const agentName = match[1];
      const sessions = await getRecentSessions(agentName, 3);
      if (sessions.length === 0) {
        return new Response(JSON.stringify(EMPTY_STATE), { headers: corsHeaders });
      }
      const state = await parseSessions(sessions);
      return new Response(JSON.stringify(state), { headers: corsHeaders });
    }

    if (url.pathname === '/agents') {
      try {
        const dirs = await readdir(AGENTS_DIR);
        const agents = dirs.filter(d => !d.startsWith('.') && !d.endsWith('.tar.gz'));
        return new Response(JSON.stringify(agents), { headers: corsHeaders });
      } catch {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
  },
});

console.log(`[session-api] OpenClaw session API running on http://localhost:${PORT}`);
console.log(`[session-api] Agents dir: ${AGENTS_DIR}`);
