/**
 * Bun WebSocket relay server for Claw Koshien 2026.
 * Relays metadata from broadcast.sh clients to the 3D viewer.
 * Also handles MC commands from mc.html.
 */

import type { CompetitionEvent, CompetitionTeam, CompetitionTask } from '../src/data/CompetitionTypes';

const PORT = parseInt(process.env.PORT ?? '9001', 10);
const API_KEY = process.env.CLAW_API_KEY ?? '';

const clients = new Set<import('bun').ServerWebSocket<unknown>>();

// ---------------------------------------------------------------------------
// In-memory competition state
// ---------------------------------------------------------------------------

const competitionState = {
  teams: new Map<string, CompetitionTeam>(),
  task: null as CompetitionTask | null,
  timerStart: null as number | null,
  timerRunning: false,
  commentary: [] as string[],
};

const MAX_COMMENTARY = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

/** Broadcast a message string to ALL connected WebSocket clients. */
function broadcastAll(data: string) {
  for (const client of clients) {
    try {
      client.send(data);
    } catch {
      clients.delete(client);
    }
  }
}

/** Serialize competition state for HTTP responses (Map -> plain object). */
function serializeState() {
  const teamsObj: Record<string, CompetitionTeam> = {};
  for (const [id, team] of competitionState.teams) {
    teamsObj[id] = team;
  }
  return {
    teams: teamsObj,
    task: competitionState.task,
    timerStart: competitionState.timerStart,
    timerRunning: competitionState.timerRunning,
    commentary: competitionState.commentary,
  };
}

/** Apply a CompetitionEvent to the in-memory state. */
function applyEvent(event: CompetitionEvent) {
  const now = Date.now();

  switch (event.type) {
    case 'progress': {
      const existing = competitionState.teams.get(event.teamId);
      const team: CompetitionTeam = existing ?? {
        id: event.teamId,
        name: event.teamName,
        score: 0,
        progress: 0,
        status: 'idle',
        tool: '',
        summary: '',
        votes: 0,
        recentTools: [],
        updatedAt: now,
      };
      if (event.status) team.status = event.status;
      if (event.tool !== undefined) {
        team.tool = event.tool;
        if (event.tool) {
          team.recentTools = [
            { name: event.tool, timestamp: new Date(now).toISOString() },
            ...team.recentTools,
          ].slice(0, 10);
        }
      }
      if (event.summary !== undefined) team.summary = event.summary;
      team.updatedAt = now;
      competitionState.teams.set(event.teamId, team);
      break;
    }
    case 'score': {
      const existing = competitionState.teams.get(event.teamId);
      const team: CompetitionTeam = existing ?? {
        id: event.teamId,
        name: event.teamName,
        score: 0,
        progress: 0,
        status: 'idle',
        tool: '',
        summary: '',
        votes: 0,
        recentTools: [],
        updatedAt: now,
      };
      if (event.score !== undefined) team.score = event.score;
      team.updatedAt = now;
      competitionState.teams.set(event.teamId, team);
      break;
    }
    case 'task': {
      competitionState.task = {
        id: `task-${now}`,
        title: event.taskTitle ?? '',
        description: event.taskDescription ?? '',
        startedAt: now,
      };
      break;
    }
    case 'timer': {
      if (event.action === 'start') {
        competitionState.timerStart = now;
        competitionState.timerRunning = true;
      } else if (event.action === 'stop') {
        competitionState.timerRunning = false;
      } else if (event.action === 'reset') {
        competitionState.timerStart = null;
        competitionState.timerRunning = false;
      }
      break;
    }
    case 'commentary': {
      if (event.commentary) {
        competitionState.commentary.push(event.commentary);
        if (competitionState.commentary.length > MAX_COMMENTARY) {
          competitionState.commentary = competitionState.commentary.slice(-MAX_COMMENTARY);
        }
      }
      break;
    }
    case 'vote': {
      const existing = competitionState.teams.get(event.teamId);
      if (existing && event.votes !== undefined) {
        existing.votes = event.votes;
        existing.updatedAt = now;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

Bun.serve({
  port: PORT,
  fetch(req: Request, server: import('bun').Server<unknown>) {
    const url = new URL(req.url);
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // POST /event — accept CompetitionEvent, update state, broadcast
    if (method === 'POST' && url.pathname === '/event') {
      if (API_KEY) {
        const auth = req.headers.get('Authorization');
        if (auth !== `Bearer ${API_KEY}`) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
      }
      return (async () => {
        try {
          const event = (await req.json()) as CompetitionEvent;
          if (!event.type || !event.teamId) {
            return jsonResponse({ error: 'Missing required fields: type, teamId' }, 400);
          }
          event.timestamp = event.timestamp ?? Date.now();
          applyEvent(event);
          const payload = JSON.stringify(event);
          broadcastAll(payload);
          return jsonResponse({ ok: true });
        } catch (err) {
          return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }
      })();
    }

    // GET /state — return current competition state
    if (method === 'GET' && url.pathname === '/state') {
      return jsonResponse(serializeState());
    }

    // WebSocket upgrade
    if (server.upgrade(req)) {
      return;
    }

    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', clients: clients.size });
    }

    return new Response('Claw Koshien 2026 Relay Server', { status: 200 });
  },
  websocket: {
    open(ws: import('bun').ServerWebSocket<unknown>) {
      clients.add(ws);
      console.log(`[relay] Client connected (total: ${clients.size})`);
    },
    message(ws: import('bun').ServerWebSocket<unknown>, message: string | Buffer) {
      const data = typeof message === 'string' ? message : new TextDecoder().decode(message);

      for (const client of clients) {
        if (client !== ws) {
          try {
            client.send(data);
          } catch {
            clients.delete(client);
          }
        }
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'state') {
          ws.send(data);
        }
      } catch {
        // Not JSON, ignore
      }
    },
    close(ws: import('bun').ServerWebSocket<unknown>) {
      clients.delete(ws);
      console.log(`[relay] Client disconnected (total: ${clients.size})`);
    },
  },
});

console.log(`[relay] Claw Koshien 2026 relay server running on ws://localhost:${PORT}`);
