import request from 'supertest';
import { app, pool } from '../app';

describe('POST /api/telemetry Ingestion Endpoint', () => {
  // Each run creates its own session and tears it down, so the suite is hermetic:
  // it no longer depends on a pre-seeded `session_id = 1`. Deleting the session
  // cascades to its telemetry_logs and test_faults (ON DELETE CASCADE).
  let sessionId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/sessions').send({
      device_family: 'EFR32MG24',
      device_id: 'TEST_REF_01',
      firmware_version: 'v2.4.1-test',
    });
    expect(res.status).toBe(201);
    sessionId = res.body.id;
    expect(typeof sessionId).toBe('number');
  });

  afterAll(async () => {
    if (sessionId) {
      await pool.query('DELETE FROM test_sessions WHERE id = $1', [sessionId]);
    }
    await pool.end();
  });

  it('should process valid telemetry payload and return 201', async () => {
    const mockPayload = {
      session_id: sessionId,
      seq: 999,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 3250.0, temp_c: 45.0, rssi_dbm: -65.0 },
      validation: { status: 'PASS', errors: [] },
    };

    const response = await request(app).post('/api/telemetry').send(mockPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('telemetry_id');
  });

  it('should handle low voltage payload and record validation warning', async () => {
    const mockPayload = {
      session_id: sessionId,
      seq: 1000,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 2900.0, temp_c: 45.0, rssi_dbm: -65.0 },
      validation: { status: 'WARN', errors: ['WARN_LOW_VOLTAGE'] },
    };

    const response = await request(app).post('/api/telemetry').send(mockPayload);

    expect(response.status).toBe(201);
  });

  it('should process critical overheat payload and record ERR_OVERHEAT_CRITICAL', async () => {
    const mockOverheatPayload = {
      session_id: sessionId,
      seq: 1001,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 3300.0, temp_c: 82.5, rssi_dbm: -60.0 }, // Temp > 75°C
      validation: { status: 'FAIL', errors: ['ERR_OVERHEAT_CRITICAL'] },
    };

    const response = await request(app).post('/api/telemetry').send(mockOverheatPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);

    // Verify backend persists the critical failure status
    const recentRes = await request(app).get('/api/telemetry/recent');
    const insertedSample = recentRes.body.find((item: any) => item.seq_number === 1001);
    expect(insertedSample).toBeDefined();
    expect(insertedSample.validation_status).toBe('FAIL');
  });

  it('should handle simultaneous multi-fault payload cleanly', async () => {
    const mockMultiFaultPayload = {
      session_id: sessionId,
      seq: 1002,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 2750.0, temp_c: 78.0, rssi_dbm: -88.0 }, // Both Voltage < 2850mV & Temp > 75°C
      validation: {
        status: 'FAIL',
        errors: ['ERR_BROWNOUT_DETECTED', 'ERR_OVERHEAT_CRITICAL', 'WARN_WEAK_RSSI'],
      },
    };

    const response = await request(app).post('/api/telemetry').send(mockMultiFaultPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('telemetry_id');
  });

  it('should confirm nominal telemetry yields 100% PASS status with empty fault array', async () => {
    const mockPassPayload = {
      session_id: sessionId,
      seq: 1003,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 3280.0, temp_c: 42.0, rssi_dbm: -55.0 }, // All nominal
      validation: { status: 'PASS', errors: [] },
    };

    const response = await request(app).post('/api/telemetry').send(mockPassPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it('GET /api/stats returns the aggregate count fields', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    for (const key of ['total_samples', 'pass_count', 'warn_count', 'fail_count']) {
      expect(res.body).toHaveProperty(key);
      expect(Number.isNaN(Number(res.body[key]))).toBe(false);
    }
  });

  it('rejects a malformed telemetry payload with 400 and error details', async () => {
    const res = await request(app)
      .post('/api/telemetry')
      .send({ session_id: sessionId, seq: 1, timestamp: new Date().toISOString() }); // no metrics/validation

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
