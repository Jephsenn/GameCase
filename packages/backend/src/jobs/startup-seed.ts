import prisma from '../lib/prisma';
import { importGamesFromRawg } from '../services/game.service';
import { config } from '../config';
import { logger } from '../lib/logger';

// ──────────────────────────────────────────────
// Startup Seed — ensures reference data and initial games exist
// ──────────────────────────────────────────────

const SEED_PLATFORMS = [
  { name: 'PC', slug: 'pc' },
  { name: 'PlayStation 5', slug: 'playstation-5' },
  { name: 'PlayStation 4', slug: 'playstation-4' },
  { name: 'Xbox Series X/S', slug: 'xbox-series-x-s' },
  { name: 'Xbox One', slug: 'xbox-one' },
  { name: 'Nintendo Switch', slug: 'nintendo-switch' },
  { name: 'iOS', slug: 'ios' },
  { name: 'Android', slug: 'android' },
  { name: 'macOS', slug: 'macos' },
  { name: 'Linux', slug: 'linux' },
];

const SEED_GENRES = [
  { name: 'Action', slug: 'action' },
  { name: 'Adventure', slug: 'adventure' },
  { name: 'RPG', slug: 'rpg' },
  { name: 'Strategy', slug: 'strategy' },
  { name: 'Simulation', slug: 'simulation' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Racing', slug: 'racing' },
  { name: 'Puzzle', slug: 'puzzle' },
  { name: 'Shooter', slug: 'shooter' },
  { name: 'Platformer', slug: 'platformer' },
  { name: 'Fighting', slug: 'fighting' },
  { name: 'Horror', slug: 'horror' },
  { name: 'Indie', slug: 'indie' },
  { name: 'MMO', slug: 'mmo' },
  { name: 'Casual', slug: 'casual' },
  { name: 'Sandbox', slug: 'sandbox' },
  { name: 'Survival', slug: 'survival' },
  { name: 'Stealth', slug: 'stealth' },
  { name: 'Music', slug: 'music' },
  { name: 'Board Game', slug: 'board-game' },
];

const SEED_TAGS = [
  { name: 'Singleplayer', slug: 'singleplayer' },
  { name: 'Multiplayer', slug: 'multiplayer' },
  { name: 'Co-op', slug: 'co-op' },
  { name: 'Open World', slug: 'open-world' },
  { name: 'Story Rich', slug: 'story-rich' },
  { name: 'Atmospheric', slug: 'atmospheric' },
  { name: 'Competitive', slug: 'competitive' },
  { name: 'First Person', slug: 'first-person' },
  { name: 'Third Person', slug: 'third-person' },
  { name: 'Pixel Graphics', slug: 'pixel-graphics' },
  { name: 'Retro', slug: 'retro' },
  { name: 'Roguelike', slug: 'roguelike' },
  { name: 'Metroidvania', slug: 'metroidvania' },
  { name: 'Souls-like', slug: 'souls-like' },
  { name: 'Turn-Based', slug: 'turn-based' },
  { name: 'Real-Time', slug: 'real-time' },
  { name: 'Crafting', slug: 'crafting' },
  { name: 'Base Building', slug: 'base-building' },
  { name: 'Narrative', slug: 'narrative' },
  { name: 'Relaxing', slug: 'relaxing' },
];

/**
 * Wait for the database to be reachable before proceeding.
 * Railway may have the DB starting up in parallel with the app.
 */
async function waitForDatabase(maxRetries = 10, delayMs = 2000): Promise<boolean> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info(`Database reachable (attempt ${i}/${maxRetries})`);
      return true;
    } catch (err) {
      logger.warn({ attempt: i, maxRetries, err }, 'Database not ready, retrying…');
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return false;
}

/**
 * Seed reference data (platforms, genres, tags) if missing, then
 * trigger an initial RAWG import when the games table is empty.
 *
 * Safe to call on every startup — it's idempotent.
 * Each step has its own error handling so one failure doesn't block others.
 */
export async function runStartupSeed(): Promise<void> {
  // ── Wait for database connectivity ────────────
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    logger.error('Database not reachable after retries — skipping startup seed');
    return;
  }

  // ── Seed platforms ────────────────────────────
  try {
    const platformCount = await prisma.platform.count();
    if (platformCount === 0) {
      logger.info('Seeding platforms…');
      for (const p of SEED_PLATFORMS) {
        await prisma.platform.upsert({ where: { slug: p.slug }, update: {}, create: p });
      }
      logger.info(`Seeded ${SEED_PLATFORMS.length} platforms`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed platforms');
  }

  // ── Seed genres ───────────────────────────────
  try {
    const genreCount = await prisma.genre.count();
    if (genreCount === 0) {
      logger.info('Seeding genres…');
      for (const g of SEED_GENRES) {
        await prisma.genre.upsert({ where: { slug: g.slug }, update: {}, create: g });
      }
      logger.info(`Seeded ${SEED_GENRES.length} genres`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed genres');
  }

  // ── Seed tags ─────────────────────────────────
  try {
    const tagCount = await prisma.tag.count();
    if (tagCount === 0) {
      logger.info('Seeding tags…');
      for (const t of SEED_TAGS) {
        await prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t });
      }
      logger.info(`Seeded ${SEED_TAGS.length} tags`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed tags');
  }

  // ── Backfill coverImage from backgroundImage ──
  try {
    const missingCover = await prisma.game.count({
      where: { coverImage: null, backgroundImage: { not: null } },
    });
    if (missingCover > 0) {
      logger.info(`Backfilling coverImage for ${missingCover} games…`);
      await prisma.$executeRawUnsafe(
        `UPDATE games SET cover_image = background_image WHERE cover_image IS NULL AND background_image IS NOT NULL`,
      );
      logger.info('coverImage backfill complete');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to backfill coverImage');
  }

  // ── Initial game import (with retry) ──────────
  try {
    const gameCount = await prisma.game.count();
    if (gameCount === 0 && config.rawgApiKey) {
      logger.info('No games in database — running initial RAWG import…');

      // Retry the import up to 3 times in case of transient RAWG API issues
      let imported = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Import popular/highly-rated games (5 pages × 40 = up to 200 games)
          const result = await importGamesFromRawg(
            { ordering: '-rating', metacritic: '75,100' },
            5,
          );
          logger.info(
            { imported: result.imported, failed: result.failed, attempt },
            'Initial game import complete',
          );

          // Also import recent releases (3 pages)
          const now = new Date();
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          const dates = `${formatDate(threeMonthsAgo)},${formatDate(now)}`;
          const recentResult = await importGamesFromRawg(
            { dates, ordering: '-released', page_size: 40 },
            3,
          );
          logger.info(
            { imported: recentResult.imported, failed: recentResult.failed },
            'Recent releases import complete',
          );

          imported = true;
          break;
        } catch (err) {
          logger.warn({ err, attempt }, `RAWG import attempt ${attempt}/3 failed`);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      }

      if (!imported) {
        logger.error('All RAWG import attempts failed — games table remains empty. Use POST /api/v1/admin/seed to retry.');
      }
    } else if (gameCount === 0 && !config.rawgApiKey) {
      logger.warn('No games in database and RAWG_API_KEY is not set — cannot import games');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to run initial game import');
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
