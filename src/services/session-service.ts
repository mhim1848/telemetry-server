import { pool } from '../db/pool';
import type { CreateSessionInput, SessionStatus } from '../schemas/session';

export interface SessionRow {
  id: number;
  device_family: string;
  device_id: string;
  firmware_version: string;
  started_at: string;
  status: string;
}

const SESSION_COLUMNS = `id, device_family, device_id, firmware_version, started_at, status`;

export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  const result = await pool.query<SessionRow>(
    `INSERT INTO test_sessions (device_family, device_id, firmware_version)
     VALUES ($1, $2, $3)
     RETURNING ${SESSION_COLUMNS};`,
    [input.device_family, input.device_id, input.firmware_version],
  );
  return result.rows[0];
}

export async function listSessions(limit = 50): Promise<SessionRow[]> {
  const result = await pool.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM test_sessions ORDER BY id DESC LIMIT $1;`,
    [limit],
  );
  return result.rows;
}

export async function getSessionById(id: number): Promise<SessionRow | undefined> {
  const result = await pool.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM test_sessions WHERE id = $1;`,
    [id],
  );
  return result.rows[0];
}

export async function updateSessionStatus(
  id: number,
  status: SessionStatus,
): Promise<SessionRow | undefined> {
  const result = await pool.query<SessionRow>(
    `UPDATE test_sessions SET status = $2 WHERE id = $1
     RETURNING ${SESSION_COLUMNS};`,
    [id, status],
  );
  return result.rows[0];
}
