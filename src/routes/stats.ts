import { Router } from 'express';
import { getStats } from '../services/telemetry-service';

export const statsRouter = Router();

// GET /api/stats — authoritative aggregate counts for the dashboard KPIs.
statsRouter.get('/', async (_req, res) => {
  const stats = await getStats();
  res.json(stats);
});
