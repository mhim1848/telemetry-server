import { Router } from 'express';
import { z } from 'zod';
import { createSessionSchema, updateSessionSchema } from '../schemas/session';
import {
  createSession,
  listSessions,
  getSessionById,
  updateSessionStatus,
} from '../services/session-service';
import { requireApiKey } from '../middleware/auth';

export const sessionsRouter = Router();

const idParamSchema = z.coerce.number().int().positive();

// POST /api/sessions — create a test session (write: API key required).
sessionsRouter.post('/', requireApiKey, async (req, res) => {
  const input = createSessionSchema.parse(req.body);
  const session = await createSession(input);
  res.status(201).json(session);
});

// GET /api/sessions — list recent sessions.
sessionsRouter.get('/', async (_req, res) => {
  const sessions = await listSessions();
  res.json(sessions);
});

// GET /api/sessions/:id — fetch a single session.
sessionsRouter.get('/:id', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const session = await getSessionById(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

// PATCH /api/sessions/:id — update lifecycle status, e.g. close a run (write: API key required).
sessionsRouter.patch('/:id', requireApiKey, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const { status } = updateSessionSchema.parse(req.body);
  const session = await updateSessionStatus(id, status);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});
