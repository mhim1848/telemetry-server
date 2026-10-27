import request from 'supertest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import { app, server, pool } from '../app';

describe('WebSocket broadcast on ingest', () => {
  let sessionId: number;
  let port: number;

  beforeAll(async () => {
    // The WS server is attached to this HTTP server; it must actually listen so a
    // real ws client can connect and receive the broadcast.
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    const res = await request(app)
      .post('/api/sessions')
      .send({ device_family: 'EFR32MG24', device_id: 'WS_TEST_01', firmware_version: 'v0' });
    sessionId = res.body.id;
  });

  afterAll(async () => {
    if (sessionId) await pool.query('DELETE FROM test_sessions WHERE id = $1', [sessionId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  it('pushes a NEW_TELEMETRY frame to connected clients when a sample is ingested', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);

    const firstMessage = new Promise<{ type: string; payload: { seq_number: number } }>(
      (resolve, reject) => {
        client.on('message', (data: Buffer) => resolve(JSON.parse(data.toString())));
        client.on('error', reject);
      },
    );
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    await request(app)
      .post('/api/telemetry')
      .send({
        session_id: sessionId,
        seq: 7777,
        timestamp: new Date().toISOString(),
        metrics: { voltage_mv: 3300, temp_c: 45, rssi_dbm: -60 },
        validation: { status: 'PASS', errors: [] },
      })
      .expect(201);

    const msg = await firstMessage;
    expect(msg.type).toBe('NEW_TELEMETRY');
    expect(msg.payload.seq_number).toBe(7777);

    client.close();
  });
});
