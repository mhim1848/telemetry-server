import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// PostgreSQL Connection Pool
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'silabs_val_db',
    password: process.env.PGPASSWORD || 'postgres',
    port: parseInt(process.env.PGPORT || '5432'),
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast helper for WebSocket clients
const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

// Telemetry POST Endpoint
app.post('/api/telemetry', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { session_id, seq, timestamp, metrics, validation } = req.body;

        await client.query('BEGIN');

        // 1. Insert Telemetry Metric Entry
        const insertLogQuery = `INSERT INTO telemetry_logs (session_id, seq_number, recorded_at, voltage_mv, temp_c, rssi_dbm, validation_status) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`;

        const logResult = await client.query(insertLogQuery, [
            session_id,
            seq,
            timestamp,
            metrics.voltage_mv,
            metrics.temp_c,
            metrics.rssi_dbm,
            validation.status
        ]);

        const telemetryId = logResult.rows[0].id;

        // 2. Insert Fault Errors (if any exist)
        if (validation.errors && validation.errors.length > 0) {
            const insertFaultQuery = `INSERT INTO test_faults (telemetry_id, error_code) VALUES ($1, $2);`;

            for (const errorCode of validation.errors) {
                await client.query(insertFaultQuery, [telemetryId, errorCode]);
            }
        }

        await client.query('COMMIT');

        // Real-Time Broadcast to Dashboard
        const liveSample = {
            id: telemetryId,
            seq_number: seq,
            recorded_at: timestamp,
            voltage_mv: metrics.voltage_mv,
            temp_c: metrics.temp_c,
            rssi_dbm: metrics.rssi_dbm,
            validation_status: validation.status,
            errors: validation.errors || []
        };
        broadcast({ type: 'NEW_TELEMETRY', payload: liveSample });

        res.status(201).json({ success: true, telemetry_id: telemetryId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error ingesting telemetry:', error);
        res.status(500).json({ error: 'Database ingestion failed' });
    } finally {
        client.release();
    }
});

// 2. Fetch Recent Telemetry (Initial Page Load)
app.get('/api/telemetry/recent', async (req: Request, res: Response) => {
    try {
        const query = `
      SELECT id, seq_number, recorded_at, voltage_mv, temp_c, rssi_dbm, validation_status 
      FROM telemetry_logs 
      ORDER BY id DESC 
      LIMIT 30;
    `;
        const result = await pool.query(query);
        res.json(result.rows.reverse()); // Chronological order
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

// 3. Summary Statistics Endpoint
app.get('/api/stats', async (req: Request, res: Response) => {
    try {
        const query = `
      SELECT 
        COUNT(*) as total_samples,
        COUNT(CASE WHEN validation_status = 'PASS' THEN 1 END) as pass_count,
        COUNT(CASE WHEN validation_status = 'WARN' THEN 1 END) as warn_count,
        COUNT(CASE WHEN validation_status = 'FAIL' THEN 1 END) as fail_count
      FROM telemetry_logs;
    `;
        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Collector Server] Running on http://0.0.0.0:${PORT}`);
});