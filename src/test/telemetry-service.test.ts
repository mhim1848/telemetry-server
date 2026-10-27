import type { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { insertTelemetry } from '../services/telemetry-service';
import type { TelemetryPayload } from '../schemas/telemetry';

// Mock the pool so this is a fast, DB-free unit test of the transaction logic.
jest.mock('../db/pool', () => ({ pool: { connect: jest.fn() } }));

describe('insertTelemetry transaction handling', () => {
  it('rolls back and releases the client when an insert fails mid-transaction', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // INSERT telemetry_logs ... RETURNING id
      .mockRejectedValueOnce(new Error('fault insert failed')) // INSERT test_faults (fails)
      .mockResolvedValueOnce(undefined); // ROLLBACK
    const release = jest.fn();
    const fakeClient = { query, release } as unknown as PoolClient;
    // pool.connect is overloaded (callback + promise forms); cast to a plain mock so
    // mockResolvedValue doesn't resolve to the void-returning overload (param: never).
    (pool.connect as unknown as jest.Mock).mockResolvedValue(fakeClient);

    const payload: TelemetryPayload = {
      session_id: 1,
      seq: 1,
      timestamp: new Date().toISOString(),
      metrics: { voltage_mv: 3300, temp_c: 45, rssi_dbm: -60 },
      validation: { status: 'FAIL', errors: ['ERR_X'] },
    };

    await expect(insertTelemetry(payload)).rejects.toThrow('fault insert failed');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
