/**
 * Admin CLI script — Reindex / reimport game data from RAWG.
 *
 * Usage:
 *   npx tsx scripts/reindex.ts                          # Default: 5 pages of top-rated
 *   npx tsx scripts/reindex.ts --pages 10               # 10 pages
 *   npx tsx scripts/reindex.ts --ordering "-released"   # Newest first
 *   npx tsx scripts/reindex.ts --genres action           # Filter by genre
 *   npx tsx scripts/reindex.ts --full                   # Full reindex (25 pages)
 */

import { importGamesFromRawg } from '../src/services/game.service';
import { disconnectRedis } from '../src/lib/redis';
import prisma from '../src/lib/prisma';

async function main() {
  const args = process.argv.slice(2);
  const flags = parseFlags(args);

  console.log('🔄 GameCase — Reindex Game Data');
  console.log('──────────────────────────────────');

  const pages = flags.full ? 25 : parseInt(flags.pages || '5');
  const ordering = flags.ordering || '-rating';
  const genres = flags.genres || undefined;
  const platforms = flags.platforms || undefined;
  const dates = flags.dates || undefined;
  const metacritic = flags.metacritic || undefined;

  console.log(`  Pages: ${pages}`);
  console.log(`  Ordering: ${ordering}`);
  if (genres) console.log(`  Genres: ${genres}`);
  if (platforms) console.log(`  Platforms: ${platforms}`);
  if (dates) console.log(`  Dates: ${dates}`);
  console.log('');

  const startTime = Date.now();

  try {
    const result = await importGamesFromRawg(
      { ordering, genres, platforms, dates, metacritic },
      pages,
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('──────────────────────────────────');
    console.log(`✅ Reindex complete in ${elapsed}s`);
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Failed:   ${result.failed}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠ Errors:`);
      for (const err of result.errors.slice(0, 20)) {
        console.log(`   • ${err}`);
      }
      if (result.errors.length > 20) {
        console.log(`   … and ${result.errors.length - 20} more`);
      }
    }

    // Print total games in DB
    const totalGames = await prisma.game.count();
    console.log(`\n📊 Total games in database: ${totalGames}`);
  } catch (error) {
    console.error('❌ Reindex failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await disconnectRedis();
  }
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Boolean flag (no value)
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        flags[key] = 'true';
      } else {
        flags[key] = args[++i];
      }
    }
  }
  return flags;
}

main();
