import { Router } from 'express';
import { telemetryPayloadSchema } from '../schemas/telemetry';
import { insertTelemetry, getRecentTelemetry } from '../services/telemetry-service';
import { broadcast } from '../ws/broadcast';
import { requireApiKey } from '../middleware/auth';

export const telemetryRouter = Router();

// POST /api/telemetry — ingest one sample, persist it, and push it to live clients (write: API key required).
telemetryRouter.post('/', requireApiKey, async (req, res) => {
  const payload = telemetryPayloadSchema.parse(req.body);
  const liveSample = await insertTelemetry(payload);
  broadcast({ type: 'NEW_TELEMETRY', payload: liveSample });
  res.status(201).json({ success: true, telemetry_id: liveSample.id });
});

// GET /api/telemetry/recent — seed the dashboard with the latest samples.
telemetryRouter.get('/recent', async (_req, res) => {
  const rows = await getRecentTelemetry();
  res.json(rows);
});
