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
 * Seed reference data (platforms, genres, tags) if missing, then
 * trigger an initial RAWG import when the games table is empty.
 *
 * Safe to call on every startup — it's idempotent.
 */
export async function runStartupSeed(): Promise<void> {
  try {
    // ── Reference data ──────────────────────────
    const [platformCount, genreCount, tagCount] = await Promise.all([
      prisma.platform.count(),
      prisma.genre.count(),
      prisma.tag.count(),
    ]);

    if (platformCount === 0) {
      logger.info('Seeding platforms…');
      for (const p of SEED_PLATFORMS) {
        await prisma.platform.upsert({ where: { slug: p.slug }, update: {}, create: p });
      }
      logger.info(`Seeded ${SEED_PLATFORMS.length} platforms`);
    }

    if (genreCount === 0) {
      logger.info('Seeding genres…');
      for (const g of SEED_GENRES) {
        await prisma.genre.upsert({ where: { slug: g.slug }, update: {}, create: g });
      }
      logger.info(`Seeded ${SEED_GENRES.length} genres`);
    }

    if (tagCount === 0) {
      logger.info('Seeding tags…');
      for (const t of SEED_TAGS) {
        await prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t });
      }
      logger.info(`Seeded ${SEED_TAGS.length} tags`);
    }

    // ── Backfill coverImage from backgroundImage ─
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

    // ── Initial game import ─────────────────────
    const gameCount = await prisma.game.count();
    if (gameCount === 0 && config.rawgApiKey) {
      logger.info('No games in database — running initial RAWG import…');

      // Import popular/highly-rated games (5 pages × 40 = up to 200 games)
      const result = await importGamesFromRawg(
        { ordering: '-rating', metacritic: '75,100' },
        5,
      );
      logger.info(
        { imported: result.imported, failed: result.failed },
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
    }
  } catch (error) {
    logger.error({ err: error }, 'Startup seed failed (non-fatal)');
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
