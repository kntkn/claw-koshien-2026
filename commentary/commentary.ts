/**
 * Commentary AI for Claw Koshien 2026.
 * Connects to the relay WebSocket, accumulates events, and generates
 * sports-style commentary every 30 seconds using claude CLI.
 *
 * Usage: bun run commentary/commentary.ts
 */

const RELAY_WS = process.env.RELAY_WS ?? "ws://localhost:9001";
const RELAY_HTTP = process.env.RELAY_HTTP ?? "http://localhost:9001";
const COMMENTARY_WEBHOOK = process.env.COMMENTARY_WEBHOOK ?? ""; // Discord webhook URL
const INTERVAL_MS = 30_000;

interface EventLog {
  type: string;
  teamName: string;
  tool?: string;
  summary?: string;
  score?: number;
  timestamp: number;
}

const eventBuffer: EventLog[] = [];
let lastCommentaryAt = 0;

// --- WebSocket connection to relay ---
function connectRelay() {
  const ws = new WebSocket(RELAY_WS);

  ws.onopen = () => {
    console.log("[commentary] Connected to relay");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(typeof event.data === "string" ? event.data : "");
      if (data.type && data.teamId) {
        eventBuffer.push({
          type: data.type,
          teamName: data.teamName ?? data.teamId,
          tool: data.tool,
          summary: data.summary,
          score: data.score,
          timestamp: Date.now(),
        });
        // Keep last 50 events
        if (eventBuffer.length > 50) eventBuffer.splice(0, eventBuffer.length - 50);
      }
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    console.log("[commentary] Disconnected, reconnecting in 5s...");
    setTimeout(connectRelay, 5000);
  };

  ws.onerror = () => ws.close();
}

// --- Generate commentary ---
async function generateCommentary() {
  const now = Date.now();
  if (now - lastCommentaryAt < INTERVAL_MS) return;

  const recentEvents = eventBuffer.filter((e) => now - e.timestamp < 60_000);
  if (recentEvents.length === 0) return;

  lastCommentaryAt = now;

  const eventSummary = recentEvents
    .map((e) => {
      if (e.type === "progress") return `${e.teamName}: ${e.tool ?? ""} ${e.summary ?? ""}`.trim();
      if (e.type === "score") return `${e.teamName}: scored ${e.score} points`;
      return `${e.teamName}: ${e.type}`;
    })
    .join("\n");

  const prompt = `You are an enthusiastic Japanese sports commentator for an AI programming competition called "Claw甲子園".
Multiple AI agent teams are competing to solve tasks.

Recent events:
${eventSummary}

Generate 1-2 sentences of exciting Japanese sports commentary about the current state of the competition.
Be dramatic, use sports metaphors, and mention specific team names.
Output ONLY the commentary text, no quotes or labels.`;

  try {
    const proc = Bun.spawn(["claude", "-p", prompt], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const commentary = output.trim();

    if (!commentary) return;

    console.log(`[commentary] ${commentary}`);

    // POST to relay
    await fetch(`${RELAY_HTTP}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "commentary",
        teamId: "_commentary",
        teamName: "Commentary",
        commentary,
      }),
    });

    // POST to Discord webhook if configured
    if (COMMENTARY_WEBHOOK) {
      await fetch(COMMENTARY_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🎙️ ${commentary}`,
        }),
      });
    }
  } catch (err) {
    console.error("[commentary] Generation failed:", err);
  }
}

// --- Main loop ---
connectRelay();
setInterval(generateCommentary, INTERVAL_MS);
console.log(`[commentary] Commentary AI started (interval: ${INTERVAL_MS / 1000}s)`);
