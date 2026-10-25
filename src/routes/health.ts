import { Router } from 'express';

export const healthRouter = Router();

// GET /health — liveness: the process is up and serving.
// (A DB-backed readiness probe at /ready is added in the ops hardening pass.)
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
