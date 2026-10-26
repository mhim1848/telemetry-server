import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../logger';

/** Constant-time string comparison to avoid leaking the key via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Require a valid `X-API-Key` header on write routes.
 *
 * If no key is configured (development), the check is a no-op — production config
 * validation guarantees `INGEST_API_KEY` is set there, so this can only be bypassed
 * in non-production environments.
 */
export const requireApiKey: RequestHandler = (req, res, next) => {
  const expected = config.ingestApiKey;
  if (!expected) {
    next();
    return;
  }

  const provided = req.header('x-api-key');
  if (provided && safeEqual(provided, expected)) {
    next();
    return;
  }

  logger.warn({ path: req.path }, 'Rejected request with missing/invalid API key');
  res.status(401).json({ error: 'Unauthorized' });
};
