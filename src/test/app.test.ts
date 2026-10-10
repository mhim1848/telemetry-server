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
});