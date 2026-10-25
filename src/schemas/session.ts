import { z } from 'zod';

/**
 * Payload for creating a test session.
 *
 * A session is a first-class domain entity: one validation *run* of a specific
 * device-under-test (a board + firmware), with a start time and a RUNNING/COMPLETED
 * status. Every telemetry sample belongs to exactly one session via a foreign key.
 *
 * The intended lifecycle is the standard REST "create parent, then stream children"
 * flow: a client (e.g. the Raspberry Pi) POSTs once at the start of a run to register
 * the session, receives its id, then tags all telemetry for that run with that id.
 * This is the mechanism that mints a valid `session_id` — not a test-only helper.
 */
export const createSessionSchema = z.object({
  device_family: z.string().min(1).max(50),
  device_id: z.string().min(1).max(50),
  firmware_version: z.string().min(1).max(50),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
