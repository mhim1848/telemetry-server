-- schema.sql: PostgreSQL Validation Database Schema

-- 1. Test Sessions Table
CREATE TABLE IF NOT EXISTS test_sessions (
                                             id SERIAL PRIMARY KEY,
                                             device_family VARCHAR(50) NOT NULL,       -- e.g., 'EFR32MG24'
    device_id VARCHAR(50) NOT NULL,           -- e.g., 'SL_BOARD_REF_01'
    firmware_version VARCHAR(50) NOT NULL,    -- e.g., 'v2.4.1-val'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                             status VARCHAR(20) DEFAULT 'RUNNING'      -- 'RUNNING', 'COMPLETED', 'FAILED'
    );

-- 2. Telemetry Logs Table (Time-Series Metric Data)
CREATE TABLE IF NOT EXISTS telemetry_logs (
                                              id BIGSERIAL PRIMARY KEY,
                                              session_id INT REFERENCES test_sessions(id) ON DELETE CASCADE,
    seq_number INT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
                                                                                              voltage_mv NUMERIC(6, 2) NOT NULL,        -- Supply Voltage in mV
    temp_c NUMERIC(5, 2) NOT NULL,            -- CPU/Die Temperature in C
    rssi_dbm NUMERIC(5, 2) NOT NULL,          -- Signal Strength in dBm
    validation_status VARCHAR(10) NOT NULL    -- 'PASS', 'WARN', 'FAIL'
    );

-- 3. Test Faults Table (Normalizing Multi-Error Codes)
CREATE TABLE IF NOT EXISTS test_faults (
                                           id BIGSERIAL PRIMARY KEY,
                                           telemetry_id BIGINT REFERENCES telemetry_logs(id) ON DELETE CASCADE,
    error_code VARCHAR(100) NOT NULL          -- e.g., 'ERR_BROWNOUT_DETECTED'
    );

-- Performance Indexes for Analytics & Dashboarding
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry_logs(validation_status);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_logs(recorded_at);