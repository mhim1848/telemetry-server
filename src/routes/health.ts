import { Router } from 'express';
import { pool } from '../db/pool';

export const healthRouter = Router();

// GET /health — liveness: the process is up and serving.
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// GET /ready — readiness: the process can reach the database.
// Returns 503 (not 500) so orchestrators treat it as "not ready", not "crashed".
healthRouter.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
