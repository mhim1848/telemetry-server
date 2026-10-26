import pino from 'pino';
import { config } from './config';

const isProd = config.nodeEnv === 'production';
const isTest = config.nodeEnv === 'test';

/**
 * Default log level per environment. Overridable at runtime via LOG_LEVEL, so
 * verbosity can be bumped (e.g. to 'debug' in prod for an investigation) without
 * a code change.
 */
const LEVEL_BY_ENV = {
  development: 'debug',
  test: 'silent',
  production: 'info',
} as const;

/**
 * Application logger. JSON in production (machine-parseable for log aggregation),
 * pretty-printed in development, and silent under test to keep the suite output clean.
 */
export const logger = pino({
  level: config.logLevel ?? LEVEL_BY_ENV[config.nodeEnv],
  transport:
    !isProd && !isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
