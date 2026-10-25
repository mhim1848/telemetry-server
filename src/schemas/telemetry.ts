import { z } from 'zod';

export const validationStatusSchema = z.enum(['PASS', 'WARN', 'FAIL']);
export type ValidationStatus = z.infer<typeof validationStatusSchema>;

/**
 * The contract for an incoming telemetry sample. Parsing a request body against
 * this schema both rejects malformed input (→ 400) and yields a fully typed value,
 * so the rest of the pipeline never touches untyped `any` from the wire.
 *
 * Numeric bounds mirror the DB column capacities (voltage NUMERIC(6,2),
 * temp/rssi NUMERIC(5,2)) so bad data is rejected at the edge rather than
 * surfacing later as a database overflow error.
 */
export const telemetryPayloadSchema = z.object({
  session_id: z.number().int().positive(),
  seq: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
  metrics: z.object({
    voltage_mv: z.number().min(0).max(9999.99),
    temp_c: z.number().min(-999.99).max(999.99),
    rssi_dbm: z.number().min(-999.99).max(999.99),
  }),
  validation: z.object({
    status: validationStatusSchema,
    errors: z.array(z.string().min(1).max(100)).default([]),
  }),
});

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
