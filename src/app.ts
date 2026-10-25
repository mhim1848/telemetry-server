import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { pool } from './db/pool';
import { initWebSocketServer } from './ws/broadcast';
import { healthRouter } from './routes/health';
import { telemetryRouter } from './routes/telemetry';
import { sessionsRouter } from './routes/sessions';
import { statsRouter } from './routes/stats';
import { notFoundHandler, errorHandler } from './middleware/error-handler';

const app = express();

// Reject oversized bodies early — telemetry samples are tiny.
app.use(express.json({ limit: '64kb' }));

// CORS driven by config: "*" reflects any origin (dev), otherwise an allow-list.
app.use(
  cors({
    origin:
      config.corsOrigin === '*'
        ? true
        : config.corsOrigin.split(',').map((origin) => origin.trim()),
  }),
);

app.use('/', healthRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);

// Error-handling middleware must be registered last.
app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
initWebSocketServer(server);

export { app, server, pool };
export default app;
