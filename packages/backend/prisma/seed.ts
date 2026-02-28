import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Platforms ────────────────────────────────
  const platforms = [
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

  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      update: {},
      create: platform,
    });
  }
  console.log(`  ✓ ${platforms.length} platforms`);

  // ── Genres ──────────────────────────────────
  const genres = [
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

  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: {},
      create: genre,
    });
  }
  console.log(`  ✓ ${genres.length} genres`);

  // ── Tags ────────────────────────────────────
  const tags = [
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

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }
  console.log(`  ✓ ${tags.length} tags`);

  console.log('✅ Seed complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
