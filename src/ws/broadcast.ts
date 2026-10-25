import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

let wss: WebSocketServer | undefined;

/** Attach a WebSocket server to the shared HTTP server. Call once at startup. */
export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server });
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
