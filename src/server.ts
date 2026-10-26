import { config } from './config';
import { server } from './app';
import { pool } from './db/pool';
import { getWebSocketServer } from './ws/broadcast';
import { logger } from './logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Collector server listening on http://0.0.0.0:${config.port}`);
});

let shuttingDown = false;

/**
 * Graceful shutdown: stop accepting work, drain connections, release the pool.
 * WebSocket clients are terminated first because their long-lived upgrade
 * connections would otherwise keep the HTTP server open indefinitely.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    const wss = getWebSocketServer();
    if (wss) {
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
    logger.info('Shutdown complete');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
