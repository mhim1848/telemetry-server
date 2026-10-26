import path from 'path';
import { runner } from 'node-pg-migrate';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Standalone migration runner. Reuses the same validated `config` as the app, so
 * migrations and the server always target the same database with the same
 * connection settings. Run via `npm run migrate [up|down]`, and on container start.
 */
async function main(): Promise<void> {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';

  await runner({
    databaseUrl: {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    },
    dir: path.resolve(__dirname, '../../migrations'),
    direction,
    count: direction === 'down' ? 1 : Infinity,
    migrationsTable: 'pgmigrations',
  });

  logger.info(`Migrations ${direction} complete`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
