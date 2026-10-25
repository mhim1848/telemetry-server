import { Pool } from 'pg';
import { config } from '../config';

/**
 * Single shared connection pool for the process. Imported by services and by the
 * app's readiness check. Pool sizing and timeouts are set explicitly so the server
 * behaves predictably under load instead of relying on library defaults.
 */
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
