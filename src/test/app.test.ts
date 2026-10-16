import request from 'supertest';
import { app } from '../app';

describe('POST /api/telemetry Ingestion Endpoint', () => {
    it('should process valid telemetry payload and return 201', async () => {
        const mockPayload = {
            session_id: 1,
            seq: 999,
            timestamp: new Date().toISOString(),
            device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
            metrics: { voltage_mv: 3250.0, temp_c: 45.0, rssi_dbm: -65.0 },
            validation: { status: 'PASS', errors: [] }
        };

        const response = await request(app)
            .post('/api/telemetry')
            .send(mockPayload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('telemetry_id');
    });

    it('should handle low voltage payload and record validation warning', async () => {
        const mockPayload = {
            session_id: 1,
            seq: 1000,
            timestamp: new Date().toISOString(),
            device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
            metrics: { voltage_mv: 2900.0, temp_c: 45.0, rssi_dbm: -65.0 },
            validation: { status: 'WARN', errors: ['WARN_LOW_VOLTAGE'] }
        };

        const response = await request(app)
            .post('/api/telemetry')
            .send(mockPayload);

        expect(response.status).toBe(201);
    });

    it('should process critical overheat payload and record ERR_OVERHEAT_CRITICAL', async () => {
    const mockOverheatPayload = {
      session_id: 1,
      seq: 1001,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 3300.0, temp_c: 82.5, rssi_dbm: -60.0 }, // Temp > 75°C
      validation: { status: 'FAIL', errors: ['ERR_OVERHEAT_CRITICAL'] }
    };

    const response = await request('http://localhost:3000')
      .post('/api/telemetry')
      .send(mockOverheatPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);

    // Verify backend persists the critical failure status
    const recentRes = await request('http://localhost:3000').get('/api/telemetry/recent');
    const insertedSample = recentRes.body.find((item: any) => item.seq_number === 1001);
    expect(insertedSample).toBeDefined();
    expect(insertedSample.validation_status).toBe('FAIL');
  });

  it('should handle simultaneous multi-fault payload cleanly', async () => {
    const mockMultiFaultPayload = {
      session_id: 1,
      seq: 1002,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 2750.0, temp_c: 78.0, rssi_dbm: -88.0 }, // Both Voltage < 2850mV & Temp > 75°C
      validation: {
        status: 'FAIL',
        errors: ['ERR_BROWNOUT_DETECTED', 'ERR_OVERHEAT_CRITICAL', 'WARN_WEAK_RSSI']
      }
    };

    const response = await request('http://localhost:3000')
      .post('/api/telemetry')
      .send(mockMultiFaultPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('telemetry_id');
  });

  it('should confirm nominal telemetry yields 100% PASS status with empty fault array', async () => {
    const mockPassPayload = {
      session_id: 1,
      seq: 1003,
      timestamp: new Date().toISOString(),
      device: { family: 'EFR32MG24', id: 'TEST_REF_01', fw: 'v2.4.1' },
      metrics: { voltage_mv: 3280.0, temp_c: 42.0, rssi_dbm: -55.0 }, // All nominal
      validation: { status: 'PASS', errors: [] }
    };

    const response = await request('http://localhost:3000')
      .post('/api/telemetry')
      .send(mockPassPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});