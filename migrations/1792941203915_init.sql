-- Up Migration
--
-- Baseline schema for the validation telemetry collector. Written idempotently
-- (IF NOT EXISTS) so it can be applied safely to environments that were already
-- provisioned from the original schema.sql. Subsequent migrations are plain,
-- non-idempotent incremental changes.

-- 1. Test sessions: one validation run of a device-under-test.
CREATE TABLE IF NOT EXISTS test_sessions (
  id               SERIAL PRIMARY KEY,
  device_family    VARCHAR(50) NOT NULL,                      -- e.g. 'EFR32MG24'
  device_id        VARCHAR(50) NOT NULL,                      -- e.g. 'SL_BOARD_REF_01'
  firmware_version VARCHAR(50) NOT NULL,                      -- e.g. 'v2.4.1-val'
  started_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status           VARCHAR(20) DEFAULT 'RUNNING'              -- 'RUNNING' | 'COMPLETED' | 'FAILED'
);

-- 2. Telemetry logs: time-series metric samples, one per reading.
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id                BIGSERIAL PRIMARY KEY,
  session_id        INT REFERENCES test_sessions(id) ON DELETE CASCADE,
  seq_number        INT NOT NULL,
  recorded_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  voltage_mv        NUMERIC(6, 2) NOT NULL,                   -- supply voltage (mV)
  temp_c            NUMERIC(5, 2) NOT NULL,                   -- CPU/die temperature (°C)
  rssi_dbm          NUMERIC(5, 2) NOT NULL,                   -- signal strength (dBm)
  validation_status VARCHAR(10) NOT NULL                      -- 'PASS' | 'WARN' | 'FAIL'
);

-- 3. Test faults: normalized multi-error codes per sample.
CREATE TABLE IF NOT EXISTS test_faults (
  id           BIGSERIAL PRIMARY KEY,
  telemetry_id BIGINT REFERENCES telemetry_logs(id) ON DELETE CASCADE,
  error_code   VARCHAR(100) NOT NULL                          -- e.g. 'ERR_BROWNOUT_DETECTED'
);

-- Indexes for analytics and dashboard queries.
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry_logs(validation_status);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_logs(recorded_at);

-- Down Migration
DROP TABLE IF EXISTS test_faults;
DROP TABLE IF EXISTS telemetry_logs;
DROP TABLE IF EXISTS test_sessions;
