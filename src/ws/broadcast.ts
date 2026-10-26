import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { config } from '../config';
import { logger } from '../logger';

/** A client socket annotated with heartbeat liveness state. */
interface AliveSocket extends WebSocket {
  isAlive?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

let wss: WebSocketServer | undefined;
let heartbeat: NodeJS.Timeout | undefined;

/** Allow the connection if its Origin is permitted by CORS config. */
function originAllowed(origin: string | undefined): boolean {
  if (config.corsOrigin === '*') return true;
  if (!origin) return false;
  return config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .includes(origin);
}

/** Attach a WebSocket server to the shared HTTP server. Call once at startup. */
export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({
    server,
    verifyClient: ({ origin }, done) => {
      if (originAllowed(origin)) {
        done(true);
        return;
      }
      logger.warn({ origin }, 'Rejected WebSocket connection from disallowed origin');
      done(false, 403, 'Forbidden origin');
    },
  });

  // Heartbeat: mark each client dead before every ping; a pong revives it. Clients
  // that miss a full interval are terminated, so broadcasts don't pile up on sockets
  // that silently went away (e.g. a laptop that slept).
  wss.on('connection', (socket: AliveSocket) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
  });

  heartbeat = setInterval(() => {
    wss?.clients.forEach((client) => {
      const socket = client as AliveSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  wss.on('close', () => {
    if (heartbeat) clearInterval(heartbeat);
  });

  return wss;
}

/** Send a JSON message to every currently-open client. No-op if not initialized. */
export function broadcast(data: unknown): void {
  if (!wss) return;
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function getWebSocketServer(): WebSocketServer | undefined {
  return wss;
}
