import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

/** Final middleware for unmatched routes. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

/**
 * Central error handler. Validation failures (ZodError) are client errors → 400
 * with field details; everything else is an unexpected server error → 500 with a
 * generic message (we don't leak internals to callers, but we do log them).
 *
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so route handlers can simply `throw` / `await` without manual try/catch.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request payload',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
