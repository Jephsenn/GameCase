import app from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { getRedis, disconnectRedis } from './lib/redis';
import { startSyncJobs } from './jobs/sync-games';
import { runStartupSeed } from './jobs/startup-seed';

async function main() {
  try {
    // Connect Redis (lazy, non-blocking if unavailable)
    try {
      await getRedis().connect();
    } catch {
      logger.warn('Redis not available — caching disabled');
    }

    // Log RAWG API key status
    if (!config.rawgApiKey) {
      logger.warn('RAWG_API_KEY is not set — game search will only return local DB results');
    } else {
      logger.info('RAWG_API_KEY is configured');
    }

    // Log Steam API key status
    if (!config.steamApiKey) {
      logger.error('STEAM_API_KEY is NOT set — Steam import and validation will fail');
    } else {
      logger.info(`STEAM_API_KEY is configured (starts with: ${config.steamApiKey.slice(0, 4)}...)`);
    }

    // Seed reference data + initial games if DB is empty
    await runStartupSeed();

    // Start background sync jobs
    startSyncJobs();

    app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'GameCase API started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down…');
  await disconnectRedis();
  process.exit(0);
});

main();
