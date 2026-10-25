import 'dotenv/config';
import { z } from 'zod';

/**
 * Non-secret defaults for local development, kept together so the full set of
 * fallbacks is readable at a glance. Secrets (the DB password, the ingest API key)
 * deliberately have NO default below — they must come from the environment, so a
 * misconfigured deployment fails loudly instead of silently using a weak value.
 */
const DEFAULTS = {
  NODE_ENV: 'development',
  PORT: 3000,
  PGHOST: 'localhost',
  PGPORT: 5432,
  PGUSER: 'postgres',
  PGDATABASE: 'silabs_val_db',
  PGSSL: 'false',
  CORS_ORIGIN: '*',
} as const;

/**
 * Environment schema. Every value the app reads from the environment is declared
 * here once, validated, and coerced to the right type. The rest of the app imports
 * the typed `config` object below and never touches `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(DEFAULTS.NODE_ENV),
  PORT: z.coerce.number().int().positive().default(DEFAULTS.PORT),

  PGHOST: z.string().min(1).default(DEFAULTS.PGHOST),
  PGPORT: z.coerce.number().int().positive().default(DEFAULTS.PGPORT),
  PGUSER: z.string().min(1).default(DEFAULTS.PGUSER),
  PGPASSWORD: z.string().min(1), // secret: required, no default
  PGDATABASE: z.string().min(1).default(DEFAULTS.PGDATABASE),
  PGSSL: z
    .enum(['true', 'false'])
    .default(DEFAULTS.PGSSL)
    .transform((v) => v === 'true'),

  // Comma-separated list of allowed origins, or "*" to allow all (dev only).
  CORS_ORIGIN: z.string().default(DEFAULTS.CORS_ORIGIN),

  // Shared secret required on ingest/write routes. Optional in dev, enforced in prod.
  INGEST_API_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// Fail fast rather than boot with insecure defaults in production.
if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (env.CORS_ORIGIN === '*') problems.push('CORS_ORIGIN must not be "*" in production');
  if (!env.INGEST_API_KEY) problems.push('INGEST_API_KEY is required in production');
  if (problems.length > 0) {
    console.error('❌ Insecure production configuration:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  ingestApiKey: env.INGEST_API_KEY,
  db: {
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    ssl: env.PGSSL,
  },
} as const;

export type Config = typeof config;
