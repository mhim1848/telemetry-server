import { pool } from '../db/pool';
import type { TelemetryPayload } from '../schemas/telemetry';

/** Shape broadcast to WebSocket clients and returned to the ingest caller. */
export interface LiveSample {
  id: string;
  seq_number: number;
  recorded_at: string;
  voltage_mv: number;
  temp_c: number;
  rssi_dbm: number;
  validation_status: string;
  errors: string[];
}

/**
 * Persist one telemetry sample and its fault codes atomically.
 *
 * The log row and any fault rows are written inside a single transaction: if any
 * insert fails the whole thing rolls back, so we never store a sample without its
 * faults (or vice versa). The checked-out client is always released.
 */
export async function insertTelemetry(payload: TelemetryPayload): Promise<LiveSample> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertLogQuery = `
      INSERT INTO telemetry_logs
        (session_id, seq_number, recorded_at, voltage_mv, temp_c, rssi_dbm, validation_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;`;
    const logResult = await client.query<{ id: string }>(insertLogQuery, [
      payload.session_id,
      payload.seq,
      payload.timestamp,
      payload.metrics.voltage_mv,
      payload.metrics.temp_c,
      payload.metrics.rssi_dbm,
      payload.validation.status,
    ]);
    const telemetryId = logResult.rows[0].id;

    if (payload.validation.errors.length > 0) {
      const insertFaultQuery = `INSERT INTO test_faults (telemetry_id, error_code) VALUES ($1, $2);`;
      for (const errorCode of payload.validation.errors) {
        await client.query(insertFaultQuery, [telemetryId, errorCode]);
      }
    }

    await client.query('COMMIT');

    return {
      id: telemetryId,
      seq_number: payload.seq,
      recorded_at: payload.timestamp,
      voltage_mv: payload.metrics.voltage_mv,
      temp_c: payload.metrics.temp_c,
      rssi_dbm: payload.metrics.rssi_dbm,
      validation_status: payload.validation.status,
      errors: payload.validation.errors,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * NUMERIC and BIGINT columns come back from `pg` as strings to avoid JS float
 * precision loss, so these fields are typed as `string` deliberately.
 */
export interface RecentTelemetryRow {
  id: string;
  seq_number: number;
  recorded_at: string;
  voltage_mv: string;
  temp_c: string;
  rssi_dbm: string;
  validation_status: string;
}

export async function getRecentTelemetry(limit = 30): Promise<RecentTelemetryRow[]> {
  const result = await pool.query<RecentTelemetryRow>(
    `SELECT id, seq_number, recorded_at, voltage_mv, temp_c, rssi_dbm, validation_status
     FROM telemetry_logs
     ORDER BY id DESC
     LIMIT $1;`,
    [limit],
  );
  return result.rows.reverse(); // chronological order for the dashboard
}

export interface TelemetryStats {
  total_samples: string;
  pass_count: string;
  warn_count: string;
  fail_count: string;
}

export async function getStats(): Promise<TelemetryStats> {
  const result = await pool.query<TelemetryStats>(
    `SELECT
       COUNT(*) AS total_samples,
       COUNT(*) FILTER (WHERE validation_status = 'PASS') AS pass_count,
       COUNT(*) FILTER (WHERE validation_status = 'WARN') AS warn_count,
       COUNT(*) FILTER (WHERE validation_status = 'FAIL') AS fail_count
     FROM telemetry_logs;`,
  );
  return result.rows[0];
}
