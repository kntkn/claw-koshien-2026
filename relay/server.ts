/**
 * Bun WebSocket relay server for Claw Koshien 2026.
 * Relays metadata from broadcast.sh clients to the 3D viewer.
 * Also handles MC commands from mc.html.
 */

const PORT = 9001;

const clients = new Set<import('bun').ServerWebSocket<unknown>>();

Bun.serve({
  port: PORT,
  fetch(req: Request, server: import('bun').Server<unknown>) {
    const url = new URL(req.url);

    if (server.upgrade(req)) {
      return;
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', clients: clients.size }), {
        headers: { 'Content-Type': 'application/json' },
      });
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
