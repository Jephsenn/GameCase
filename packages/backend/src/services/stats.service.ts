import prisma from '../lib/prisma';

// ──────────────────────────────────────────────
// Stats Service — Year in Review / user statistics
// ──────────────────────────────────────────────

export interface UserStats {
  totalGamesTracked: number;
  totalLibraries: number;
  topGenres: { name: string; count: number }[];
  topRatedGames: {
    title: string;
    slug: string;
    userRating: number;
    backgroundImage: string | null;
  }[];
  mostActiveMonth: { month: string; count: number } | null;
  friendCount: number;
  gamesAddedThisYear: number;
  gamesRatedCount: number;
  averageRating: number | null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${currentYear + 1}-01-01T00:00:00.000Z`);

  // Total unique games across all libraries
  const totalGamesTracked = await prisma.libraryItem.count({
    where: { library: { userId } },
  });

  // Total libraries
  const totalLibraries = await prisma.library.count({ where: { userId } });

  // Top genres by games in library
  const genreCounts = await prisma.$queryRaw<{ name: string; count: bigint }[]>`
    SELECT g.name, COUNT(DISTINCT li.game_id) as count
    FROM library_items li
    JOIN libraries l ON li.library_id = l.id
    JOIN game_genres gg ON li.game_id = gg.game_id
    JOIN genres g ON gg.genre_id = g.id
    WHERE l.user_id = ${userId}
    GROUP BY g.name
    ORDER BY count DESC
    LIMIT 5
  `;
  const topGenres = genreCounts.map((row) => ({
    name: row.name,
    count: Number(row.count),
  }));

  // Top rated games by user rating
  const topRatedItems = await prisma.libraryItem.findMany({
    where: {
      library: { userId },
      userRating: { not: null },
    },
    orderBy: { userRating: 'desc' },
    take: 5,
    select: {
      userRating: true,
      game: {
        select: {
          title: true,
          slug: true,
          backgroundImage: true,
        },
      },
    },
  });
  const topRatedGames = topRatedItems.map((item) => ({
    title: item.game.title,
    slug: item.game.slug,
    userRating: item.userRating!,
    backgroundImage: item.game.backgroundImage,
  }));

  // Most active month (by game_added activity events this year)
  const monthCounts = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM activity_feed_items
    WHERE user_id = ${userId}
      AND type = 'game_added'
      AND created_at >= ${yearStart}
      AND created_at < ${yearEnd}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY count DESC
    LIMIT 1
  `;
  const mostActiveMonth =
    monthCounts.length > 0
      ? { month: monthCounts[0].month, count: Number(monthCounts[0].count) }
      : null;

  // Friend count
  const friendCount = await prisma.friendship.count({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { recipientId: userId }],
    },
  });

  // Games added this year
  const gamesAddedThisYear = await prisma.activityFeedItem.count({
    where: {
      userId,
      type: 'game_added',
      createdAt: { gte: yearStart, lt: yearEnd },
    },
  });

  // Games rated count + average
  const ratingAgg = await prisma.libraryItem.aggregate({
    where: {
      library: { userId },
      userRating: { not: null },
    },
    _count: true,
    _avg: { userRating: true },
  });

  return {
    totalGamesTracked,
    totalLibraries,
    topGenres,
    topRatedGames,
    mostActiveMonth,
    friendCount,
    gamesAddedThisYear,
    gamesRatedCount: ratingAgg._count,
    averageRating: ratingAgg._avg.userRating ?? null,
  };
}
