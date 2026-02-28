import prisma from '../lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { CACHE_TTL, PAGINATION } from '@gametracker/shared';

// ──────────────────────────────────────────────
// Recommendation Service — content-based + popularity engine
// ──────────────────────────────────────────────

export class RecommendationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

// ── Types ──────────────────────────────────────

interface UserTasteProfile {
  genreWeights: Map<string, number>;
  tagWeights: Map<string, number>;
  platformIds: Set<string>;
  averageRating: number;
  totalGames: number;
}

interface ScoredGame {
  gameId: string;
  score: number;
  reasons: string[];
  reasonText: string;
}

// ── Constants ──────────────────────────────────

const WEIGHTS = {
  GENRE_MATCH: 0.35,
  TAG_MATCH: 0.25,
  PLATFORM_MATCH: 0.05,
  POPULARITY: 0.15,
  METACRITIC: 0.10,
  RECENCY: 0.10,
} as const;

const RECOMMENDATION_COUNT = 30;
const CANDIDATE_POOL_SIZE = 200;
const EXPIRY_HOURS = 24;

// ── Taste Profile Builder ──────────────────────

/**
 * Analyze all games in a user's libraries to build a weighted preference profile.
 * Games the user rated higher contribute more to the profile.
 */
async function buildUserTasteProfile(userId: string): Promise<UserTasteProfile> {
  const libraryItems = await prisma.libraryItem.findMany({
    where: { library: { userId } },
    select: {
      userRating: true,
      game: {
        select: {
          id: true,
          rating: true,
          genres: { select: { genreId: true } },
          tags: { select: { tagId: true } },
          platforms: { select: { platformId: true } },
        },
      },
    },
  });

  const genreWeights = new Map<string, number>();
  const tagWeights = new Map<string, number>();
  const platformIds = new Set<string>();
  let ratingSum = 0;
  let ratingCount = 0;

  for (const item of libraryItems) {
    // Weight: user rating (1-10 → normalized to 0.1-1.0) or default 0.6
    const weight = item.userRating ? item.userRating / 10 : 0.6;

    for (const g of item.game.genres) {
      genreWeights.set(g.genreId, (genreWeights.get(g.genreId) || 0) + weight);
    }

    for (const t of item.game.tags) {
      tagWeights.set(t.tagId, (tagWeights.get(t.tagId) || 0) + weight);
    }

    for (const p of item.game.platforms) {
      platformIds.add(p.platformId);
    }

    if (item.userRating) {
      ratingSum += item.userRating;
      ratingCount++;
    }
  }

  // Normalize weights to 0-1 range
  normalizeWeights(genreWeights);
  normalizeWeights(tagWeights);

  return {
    genreWeights,
    tagWeights,
    platformIds,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : 5,
    totalGames: libraryItems.length,
  };
}

function normalizeWeights(weights: Map<string, number>): void {
  if (weights.size === 0) return;
  const max = Math.max(...weights.values());
  if (max === 0) return;
  for (const [key, value] of weights) {
    weights.set(key, value / max);
  }
}

// ── Candidate Selection ────────────────────────

/**
 * Get game IDs the user already has in any library.
 */
async function getUserGameIds(userId: string): Promise<Set<string>> {
  const items = await prisma.libraryItem.findMany({
    where: { library: { userId } },
    select: { gameId: true },
  });
  return new Set(items.map((i) => i.gameId));
}

/**
 * Select candidate games that the user hasn't already added.
 * Pulls from multiple pools: genre-matching, highly rated, and recent.
 */
async function selectCandidates(
  profile: UserTasteProfile,
  excludeIds: Set<string>,
): Promise<string[]> {
  const candidateIds = new Set<string>();
  const excludeArray = [...excludeIds];

  // Pool 1: Games matching top genres
  const topGenres = [...profile.genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  if (topGenres.length > 0) {
    const genreGames = await prisma.game.findMany({
      where: {
        genres: { some: { genreId: { in: topGenres } } },
        id: { notIn: excludeArray },
      },
      select: { id: true },
      orderBy: { rating: 'desc' },
      take: CANDIDATE_POOL_SIZE,
    });
    genreGames.forEach((g) => candidateIds.add(g.id));
  }

  // Pool 2: Games matching top tags
  const topTags = [...profile.tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  if (topTags.length > 0) {
    const tagGames = await prisma.game.findMany({
      where: {
        tags: { some: { tagId: { in: topTags } } },
        id: { notIn: excludeArray },
      },
      select: { id: true },
      orderBy: { rating: 'desc' },
      take: CANDIDATE_POOL_SIZE,
    });
    tagGames.forEach((g) => candidateIds.add(g.id));
  }

  // Pool 3: Highly rated / popular games
  const popularGames = await prisma.game.findMany({
    where: {
      id: { notIn: excludeArray },
      rating: { gte: 3.5 },
      ratingCount: { gte: 100 },
    },
    select: { id: true },
    orderBy: { rating: 'desc' },
    take: Math.floor(CANDIDATE_POOL_SIZE / 2),
  });
  popularGames.forEach((g) => candidateIds.add(g.id));

  // Pool 4: Recent releases (last 2 years)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const recentGames = await prisma.game.findMany({
    where: {
      id: { notIn: excludeArray },
      releaseDate: { gte: twoYearsAgo },
      rating: { gte: 3.0 },
    },
    select: { id: true },
    orderBy: { releaseDate: 'desc' },
    take: Math.floor(CANDIDATE_POOL_SIZE / 2),
  });
  recentGames.forEach((g) => candidateIds.add(g.id));

  return [...candidateIds];
}

// ── Scoring ────────────────────────────────────

/**
 * Score each candidate against the user's taste profile.
 */
async function scoreCandidates(
  candidateIds: string[],
  profile: UserTasteProfile,
): Promise<ScoredGame[]> {
  if (candidateIds.length === 0) return [];

  // Bulk load candidate game data
  const games = await prisma.game.findMany({
    where: { id: { in: candidateIds } },
    select: {
      id: true,
      title: true,
      rating: true,
      ratingCount: true,
      metacritic: true,
      releaseDate: true,
      genres: { select: { genreId: true, genre: { select: { name: true } } } },
      tags: { select: { tagId: true, tag: { select: { name: true } } } },
      platforms: { select: { platformId: true } },
    },
  });

  const now = Date.now();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;

  return games.map((game) => {
    const reasons: string[] = [];
    const reasonParts: string[] = [];

    // ── Genre score ──
    let genreScore = 0;
    const matchedGenres: string[] = [];
    for (const g of game.genres) {
      const w = profile.genreWeights.get(g.genreId) || 0;
      genreScore += w;
      if (w > 0.3) matchedGenres.push(g.genre.name);
    }
    genreScore = game.genres.length > 0 ? genreScore / game.genres.length : 0;
    if (genreScore > 0.2) {
      reasons.push('genre');
      reasonParts.push(`Matches genres you enjoy: ${matchedGenres.slice(0, 3).join(', ')}`);
    }

    // ── Tag score ──
    let tagScore = 0;
    const matchedTags: string[] = [];
    for (const t of game.tags) {
      const w = profile.tagWeights.get(t.tagId) || 0;
      tagScore += w;
      if (w > 0.3) matchedTags.push(t.tag.name);
    }
    tagScore = game.tags.length > 0 ? Math.min(tagScore / Math.min(game.tags.length, 5), 1) : 0;
    if (tagScore > 0.2) {
      reasons.push('tag');
      reasonParts.push(`Similar tags: ${matchedTags.slice(0, 3).join(', ')}`);
    }

    // ── Platform score ──
    let platformScore = 0;
    for (const p of game.platforms) {
      if (profile.platformIds.has(p.platformId)) {
        platformScore = 1;
        break;
      }
    }

    // ── Popularity score (normalized rating × rating count factor) ──
    const ratingNorm = game.rating ? game.rating / 5 : 0;
    const countFactor = game.ratingCount
      ? Math.min(Math.log10(game.ratingCount) / 5, 1)
      : 0;
    const popularityScore = ratingNorm * 0.6 + countFactor * 0.4;
    if (popularityScore > 0.7) {
      reasons.push('popular');
      reasonParts.push('Highly rated by the community');
    }

    // ── Metacritic score ──
    const metacriticScore = game.metacritic ? game.metacritic / 100 : 0;

    // ── Recency score ──
    let recencyScore = 0;
    if (game.releaseDate) {
      const age = now - game.releaseDate.getTime();
      recencyScore = Math.max(0, 1 - age / twoYearsMs);
      if (recencyScore > 0.5) {
        reasons.push('new_release');
        reasonParts.push('Recently released');
      }
    }

    // ── Weighted total ──
    const score =
      genreScore * WEIGHTS.GENRE_MATCH +
      tagScore * WEIGHTS.TAG_MATCH +
      platformScore * WEIGHTS.PLATFORM_MATCH +
      popularityScore * WEIGHTS.POPULARITY +
      metacriticScore * WEIGHTS.METACRITIC +
      recencyScore * WEIGHTS.RECENCY;

    // Fallback reasons
    if (reasons.length === 0) {
      reasons.push('popular');
      reasonParts.push('Popular game you might enjoy');
    }

    return {
      gameId: game.id,
      score: Math.round(score * 1000) / 1000, // 3 decimal places
      reasons,
      reasonText: reasonParts.join('. ') + '.',
    };
  });
}

// ── Generation & Persistence ───────────────────

/**
 * Generate fresh recommendations for a user — the main entry point.
 * Builds taste profile → selects candidates → scores → persists top N.
 */
export async function generateRecommendations(userId: string): Promise<number> {
  const profile = await buildUserTasteProfile(userId);

  // If user has no games, generate popularity-only recs
  const excludeIds = await getUserGameIds(userId);
  const candidateIds = await selectCandidates(profile, excludeIds);
  const scored = await scoreCandidates(candidateIds, profile);

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, RECOMMENDATION_COUNT);

  if (top.length === 0) return 0;

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  // Delete old recommendations
  await prisma.recommendation.deleteMany({ where: { userId } });

  // Insert new ones
  await prisma.recommendation.createMany({
    data: top.map((rec) => ({
      userId,
      gameId: rec.gameId,
      score: rec.score,
      reasons: rec.reasons,
      reasonText: rec.reasonText,
      expiresAt,
    })),
  });

  // Invalidate cache
  await cacheDel(`user:${userId}:recommendations`);

  return top.length;
}

// ── Retrieval ──────────────────────────────────

/**
 * Get recommendations for a user, with optional pagination.
 * Auto-generates if none exist or all are expired.
 */
export async function getRecommendations(
  userId: string,
  page: number = 1,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
) {
  const cacheKey = `user:${userId}:recommendations:${page}:${pageSize}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  // Check if we have valid (non-expired) recommendations
  const count = await prisma.recommendation.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });

  // Auto-generate if empty or expired
  if (count === 0) {
    await generateRecommendations(userId);
  }

  const total = await prisma.recommendation.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });

  const recs = await prisma.recommendation.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { score: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      game: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          backgroundImage: true,
          rating: true,
          releaseDate: true,
          genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
          platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
        },
      },
    },
  });

  const totalPages = Math.ceil(total / pageSize);

  const result = {
    items: recs.map((rec) => ({
      id: rec.id,
      score: rec.score,
      reasons: rec.reasons,
      reasonText: rec.reasonText,
      game: {
        id: rec.game.id,
        slug: rec.game.slug,
        title: rec.game.title,
        coverImage: rec.game.coverImage,
        backgroundImage: rec.game.backgroundImage,
        rating: rec.game.rating,
        releaseDate: rec.game.releaseDate?.toISOString() ?? null,
        genres: rec.game.genres.map((g) => g.genre),
        platforms: rec.game.platforms.map((p) => p.platform),
      },
    })),
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.RECOMMENDATIONS);
  return result;
}

/**
 * Dismiss a specific recommendation (delete it).
 */
export async function dismissRecommendation(userId: string, recommendationId: string): Promise<void> {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });

  if (!rec || rec.userId !== userId) {
    throw new RecommendationError('Recommendation not found', 404);
  }

  await prisma.recommendation.delete({ where: { id: recommendationId } });
  await cacheDel(`user:${userId}:recommendations`);
  // Invalidate all paginated caches too
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);
}

/**
 * Force-refresh recommendations for the user.
 */
export async function refreshRecommendations(userId: string): Promise<number> {
  // Invalidate cache
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);
  await cacheDel(`user:${userId}:recommendations`);

  return generateRecommendations(userId);
}

// ── Batch generation (for cron) ────────────────

/**
 * Regenerate recommendations for all users who have at least one library item.
 * Intended to be called by a background cron job.
 */
export async function regenerateAllRecommendations(): Promise<{ processed: number; errors: number }> {
  const users = await prisma.user.findMany({
    where: { libraries: { some: { items: { some: {} } } } },
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await generateRecommendations(user.id);
      processed++;
    } catch (err) {
      console.error(`[recommendations] Failed for user ${user.id}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}
