import { Router } from 'express';
import { createSessionSchema } from '../schemas/session';
import { createSession } from '../services/session-service';

export const sessionsRouter = Router();

// POST /api/sessions — create a test session and return its id for ingestion.
sessionsRouter.post('/', async (req, res) => {
  const input = createSessionSchema.parse(req.body);
  const session = await createSession(input);
  res.status(201).json(session);
});
