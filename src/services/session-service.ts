import { pool } from '../db/pool';
import type { CreateSessionInput } from '../schemas/session';

export interface SessionRow {
  id: number;
  device_family: string;
  device_id: string;
  firmware_version: string;
  started_at: string;
  status: string;
}

export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  const result = await pool.query<SessionRow>(
    `INSERT INTO test_sessions (device_family, device_id, firmware_version)
     VALUES ($1, $2, $3)
     RETURNING id, device_family, device_id, firmware_version, started_at, status;`,
    [input.device_family, input.device_id, input.firmware_version],
  );
  return result.rows[0];
}
