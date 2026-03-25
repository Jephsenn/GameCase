import prisma from '../lib/prisma';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { CACHE_TTL, PAGINATION } from '@gamecase/shared';
import { searchRawgGames, type RawgGameListItem } from '../lib/rawg';
import { ingestRawgGame } from './game.service';
import { logger } from '../lib/logger';

// ──────────────────────────────────────────────
// Recommendation Service — content-based + popularity engine
// Enhanced with live RAWG enrichment for relevant, popular,
// and recent game candidates.
// ──────────────────────────────────────────────

const log = logger.child({ module: 'recommendations' });

// ── Generation lock — prevents concurrent runs per user ──
export const generationInProgress = new Set<string>();

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
  genreSlugs: Map<string, string>; // genreId → slug for RAWG queries
  tagWeights: Map<string, number>;
  tagSlugs: Map<string, string>; // tagId → slug for RAWG queries
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
  GENRE_MATCH: 0.30,
  TAG_MATCH: 0.20,
  PLATFORM_MATCH: 0.05,
  POPULARITY: 0.20,
  METACRITIC: 0.10,
  RECENCY: 0.15,
} as const;

const RECOMMENDATION_COUNT = 30;
const CANDIDATE_POOL_SIZE = 200;
const RAWG_ENRICHMENT_PAGE_SIZE = 40;
const EXPIRY_HOURS = 24;
const MIN_RATING_FOR_CANDIDATES = 3.0;
const MIN_RATING_COUNT = 20;

// ── Taste Profile Builder ──────────────────────

/**
 * Analyze all games in a user's libraries to build a weighted preference profile.
 * Games the user rated higher contribute more to the profile.
 * Also captures genre/tag slugs so we can query RAWG for similar games.
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
          genres: { select: { genreId: true, genre: { select: { slug: true } } } },
          tags: { select: { tagId: true, tag: { select: { slug: true } } } },
          platforms: { select: { platformId: true } },
        },
      },
    },
  });

  const genreWeights = new Map<string, number>();
  const genreSlugs = new Map<string, string>();
  const tagWeights = new Map<string, number>();
  const tagSlugs = new Map<string, string>();
  const platformIds = new Set<string>();
  let ratingSum = 0;
  let ratingCount = 0;

  for (const item of libraryItems) {
    // Weight: user rating (1-10 → normalized to 0.1-1.0) or default 0.6
    const weight = item.userRating ? item.userRating / 10 : 0.6;

    for (const g of item.game.genres) {
      genreWeights.set(g.genreId, (genreWeights.get(g.genreId) || 0) + weight);
      genreSlugs.set(g.genreId, g.genre.slug);
    }

    for (const t of item.game.tags) {
      tagWeights.set(t.tagId, (tagWeights.get(t.tagId) || 0) + weight);
      tagSlugs.set(t.tagId, t.tag.slug);
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
    genreSlugs,
    tagWeights,
    tagSlugs,
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
 * Get game IDs the user has previously dismissed.
 * These should never appear in recommendations again.
 */
async function getDismissedGameIds(userId: string): Promise<Set<string>> {
  const dismissed = await prisma.dismissedRecommendation.findMany({
    where: { userId },
    select: { gameId: true },
  });
  return new Set(dismissed.map((d) => d.gameId));
}

/**
 * Select candidate games that the user hasn't already added.
 * Pulls from multiple pools: genre-matching, highly rated, and recent.
 * Quality floors ensure we only surface games worth recommending.
 */
async function selectCandidates(
  profile: UserTasteProfile,
  excludeIds: Set<string>,
): Promise<string[]> {
  const candidateIds = new Set<string>();
  const excludeArray = [...excludeIds];

  // Pool 1: Games matching top genres (quality-filtered)
  const topGenres = [...profile.genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  if (topGenres.length > 0) {
    const genreGames = await prisma.game.findMany({
      where: {
        genres: { some: { genreId: { in: topGenres } } },
        id: { notIn: excludeArray },
        rating: { gte: MIN_RATING_FOR_CANDIDATES },
        ratingCount: { gte: MIN_RATING_COUNT },
      },
      select: { id: true },
      orderBy: { rating: 'desc' },
      take: CANDIDATE_POOL_SIZE,
    });
    genreGames.forEach((g) => candidateIds.add(g.id));
  }

  // Pool 2: Games matching top tags (quality-filtered)
  const topTags = [...profile.tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  if (topTags.length > 0) {
    const tagGames = await prisma.game.findMany({
      where: {
        tags: { some: { tagId: { in: topTags } } },
        id: { notIn: excludeArray },
        rating: { gte: MIN_RATING_FOR_CANDIDATES },
        ratingCount: { gte: MIN_RATING_COUNT },
      },
      select: { id: true },
      orderBy: { rating: 'desc' },
      take: CANDIDATE_POOL_SIZE,
    });
    tagGames.forEach((g) => candidateIds.add(g.id));
  }

  // Pool 3: Highly rated / popular games (higher quality bar)
  const popularGames = await prisma.game.findMany({
    where: {
      id: { notIn: excludeArray },
      rating: { gte: 3.5 },
      ratingCount: { gte: 100 },
    },
    select: { id: true },
    orderBy: [{ ratingCount: 'desc' }, { rating: 'desc' }],
    take: Math.floor(CANDIDATE_POOL_SIZE / 2),
  });
  popularGames.forEach((g) => candidateIds.add(g.id));

  // Pool 4: Recent releases (last 2 years, quality-filtered)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const recentGames = await prisma.game.findMany({
    where: {
      id: { notIn: excludeArray },
      releaseDate: { gte: twoYearsAgo },
      rating: { gte: MIN_RATING_FOR_CANDIDATES },
      ratingCount: { gte: MIN_RATING_COUNT },
    },
    select: { id: true },
    orderBy: [{ releaseDate: 'desc' }, { rating: 'desc' }],
    take: Math.floor(CANDIDATE_POOL_SIZE / 2),
  });
  recentGames.forEach((g) => candidateIds.add(g.id));

  // Pool 5: High metacritic games
  const metacriticGames = await prisma.game.findMany({
    where: {
      id: { notIn: excludeArray },
      metacritic: { gte: 75 },
      ratingCount: { gte: 50 },
    },
    select: { id: true },
    orderBy: { metacritic: 'desc' },
    take: Math.floor(CANDIDATE_POOL_SIZE / 3),
  });
  metacriticGames.forEach((g) => candidateIds.add(g.id));

  return [...candidateIds];
}

// ── RAWG Enrichment ────────────────────────────

/**
 * Fetch popular & relevant games from RAWG based on the user's taste profile
 * and ingest them into the local DB. This ensures the recommendation candidate
 * pool always contains recent, popular, and genre-relevant games — not just
 * whatever the user has previously searched for.
 */
async function enrichCandidatePoolFromRawg(profile: UserTasteProfile): Promise<void> {
  const ingestBatch = async (games: RawgGameListItem[]) => {
    for (const game of games) {
      try {
        await ingestRawgGame(game);
      } catch {
        // Non-fatal — skip games that fail to ingest
      }
    }
  };

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const dateRangeYear = `${formatDate(oneYearAgo)},${formatDate(now)}`;
  const dateRange6Mo = `${formatDate(sixMonthsAgo)},${formatDate(now)}`;

  // ── 1. Fetch games in user's top genres (sorted by RAWG rating) ──
  const topGenreSlugs = [...profile.genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => profile.genreSlugs.get(id))
    .filter(Boolean) as string[];

  if (topGenreSlugs.length > 0) {
    try {
      const genreResult = await searchRawgGames({
        genres: topGenreSlugs.join(','),
        ordering: '-metacritic',
        metacritic: '70,100',
        page_size: RAWG_ENRICHMENT_PAGE_SIZE,
        page: 1,
      });
      await ingestBatch(genreResult.results);
      log.debug({ genres: topGenreSlugs, count: genreResult.results.length }, 'Enriched: genre-matched games');
    } catch (err) {
      log.warn({ err }, 'RAWG enrichment failed: genre-matched');
    }

    // Also fetch recent games in those genres
    try {
      const recentGenreResult = await searchRawgGames({
        genres: topGenreSlugs.join(','),
        ordering: '-released',
        dates: dateRangeYear,
        metacritic: '60,100',
        page_size: RAWG_ENRICHMENT_PAGE_SIZE,
        page: 1,
      });
      await ingestBatch(recentGenreResult.results);
      log.debug({ count: recentGenreResult.results.length }, 'Enriched: recent genre-matched games');
    } catch (err) {
      log.warn({ err }, 'RAWG enrichment failed: recent genre-matched');
    }
  }

  // ── 2. Fetch top-rated recent releases (any genre) ──
  try {
    const recentTopRated = await searchRawgGames({
      ordering: '-metacritic',
      dates: dateRangeYear,
      metacritic: '75,100',
      page_size: RAWG_ENRICHMENT_PAGE_SIZE,
      page: 1,
    });
    await ingestBatch(recentTopRated.results);
    log.debug({ count: recentTopRated.results.length }, 'Enriched: top-rated recent releases');
  } catch (err) {
    log.warn({ err }, 'RAWG enrichment failed: top-rated recent');
  }

  // ── 3. Fetch trending / most-added games (last 6 months) ──
  try {
    const trending = await searchRawgGames({
      ordering: '-added',
      dates: dateRange6Mo,
      page_size: RAWG_ENRICHMENT_PAGE_SIZE,
      page: 1,
    });
    await ingestBatch(trending.results);
    log.debug({ count: trending.results.length }, 'Enriched: trending/most-added games');
  } catch (err) {
    log.warn({ err }, 'RAWG enrichment failed: trending');
  }

  // ── 4. Fetch popular games with high community ratings ──
  try {
    const popular = await searchRawgGames({
      ordering: '-rating',
      metacritic: '80,100',
      page_size: RAWG_ENRICHMENT_PAGE_SIZE,
      page: 1,
    });
    await ingestBatch(popular.results);
    log.debug({ count: popular.results.length }, 'Enriched: popular high-rated games');
  } catch (err) {
    log.warn({ err }, 'RAWG enrichment failed: popular');
  }

  // Small delay to be respectful to the API
  await new Promise((r) => setTimeout(r, 200));
}

// ── Scoring ────────────────────────────────────

/**
 * Score each candidate against the user's taste profile.
 * Balances personal taste matching with quality / popularity signals
 * to produce recommendations that feel both relevant and noteworthy.
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
  const threeYearsMs = 3 * 365 * 24 * 60 * 60 * 1000;

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

    // ── Popularity score ──
    // Combines community rating with volume — a 4.5★ game with 10K reviews
    // scores much higher than a 4.5★ game with 50 reviews.
    const ratingNorm = game.rating ? game.rating / 5 : 0;
    const countFactor = game.ratingCount
      ? Math.min(Math.log10(Math.max(game.ratingCount, 1)) / 5, 1)
      : 0;
    const popularityScore = ratingNorm * 0.5 + countFactor * 0.5;
    if (popularityScore > 0.6) {
      reasons.push('popular');
      reasonParts.push('Highly rated by the community');
    }

    // ── Metacritic score ──
    // Scale: 0-100 → 0-1, but give a bonus above 80
    let metacriticScore = 0;
    if (game.metacritic) {
      metacriticScore = game.metacritic / 100;
      if (game.metacritic >= 80) {
        metacriticScore = Math.min(metacriticScore * 1.15, 1); // bonus for critically acclaimed
      }
    }

    // ── Recency score ──
    // Wider window (3 years) with a smooth decay curve
    let recencyScore = 0;
    if (game.releaseDate) {
      const age = now - game.releaseDate.getTime();
      recencyScore = Math.max(0, 1 - (age / threeYearsMs) ** 0.7);
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
      if (metacriticScore > 0.75) {
        reasons.push('popular');
        reasonParts.push('Critically acclaimed game you might enjoy');
      } else {
        reasons.push('popular');
        reasonParts.push('Popular game you might enjoy');
      }
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
 * 1. Build taste profile from user's library
 * 2. Enrich the local DB with relevant games from RAWG
 * 3. Select candidates from the enriched pool
 * 4. Score and persist top N
 */
export async function generateRecommendations(userId: string): Promise<number> {
  // Prevent concurrent generation for the same user
  if (generationInProgress.has(userId)) {
    log.info({ userId }, 'Generation already in progress, skipping');
    return 0;
  }
  generationInProgress.add(userId);
  try {
    return await _doGenerateRecommendations(userId);
  } finally {
    generationInProgress.delete(userId);
  }
}

async function _doGenerateRecommendations(userId: string): Promise<number> {
  const profile = await buildUserTasteProfile(userId);

  // Exclude both library games and previously dismissed games
  const [libraryGameIds, dismissedGameIds] = await Promise.all([
    getUserGameIds(userId),
    getDismissedGameIds(userId),
  ]);
  const excludeIds = new Set([...libraryGameIds, ...dismissedGameIds]);

  // Enrich local DB with popular, relevant, and recent games from RAWG.
  // This is the key step that ensures the candidate pool isn't limited to
  // whatever the user has previously searched for.
  //
  // However, skip enrichment if we already have enough local candidates —
  // this avoids 20-30 s waits on 5 sequential RAWG HTTP calls during
  // quick refreshes.
  const localCandidateCount = await prisma.game.count({
    where: {
      id: { notIn: [...excludeIds] },
      rating: { gte: MIN_RATING_FOR_CANDIDATES },
      ratingCount: { gte: MIN_RATING_COUNT },
    },
  });

  if (localCandidateCount < CANDIDATE_POOL_SIZE) {
    try {
      await enrichCandidatePoolFromRawg(profile);
      log.info({ userId, profileGames: profile.totalGames }, 'RAWG enrichment completed');
    } catch (err) {
      // Enrichment is best-effort — continue with local DB if RAWG fails
      log.warn({ err, userId }, 'RAWG enrichment failed, using local DB only');
    }
  } else {
    log.info(
      { userId, localCandidateCount },
      'Skipping RAWG enrichment — enough local candidates',
    );
  }

  const candidateIds = await selectCandidates(profile, excludeIds);
  const scored = await scoreCandidates(candidateIds, profile);

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, RECOMMENDATION_COUNT);

  if (top.length === 0) return 0;

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  // Atomic swap — delete old + insert new in a single transaction so
  // the DB never has 0 recs visible to concurrent readers.
  await prisma.$transaction([
    prisma.recommendation.deleteMany({ where: { userId } }),
    prisma.recommendation.createMany({
      data: top.map((rec) => ({
        userId,
        gameId: rec.gameId,
        score: rec.score,
        reasons: rec.reasons,
        reasonText: rec.reasonText,
        expiresAt,
      })),
    }),
  ]);

  // Invalidate cache
  await cacheDel(`user:${userId}:recommendations`);
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);

  log.info({ userId, count: top.length, topScore: top[0]?.score }, 'Recommendations generated');
  return top.length;
} // end _doGenerateRecommendations

// ── Retrieval ──────────────────────────────────

/** Minimum remaining recs before we auto-replenish in the background */
const AUTO_REPLENISH_THRESHOLD = 10;

/**
 * Get recommendations for a user, with optional pagination.
 * Auto-generates if none exist or all are expired.
 * Auto-replenishes in the background when dismissals bring the count low.
 */
export async function getRecommendations(
  userId: string,
  page: number = 1,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
) {
  // Check if we have valid (non-expired) recommendations
  const count = await prisma.recommendation.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });

  // Auto-generate if empty or expired (synchronous — first-time / expiry case only).
  // NOTE: We intentionally do NOT fire-and-forget a background regeneration when
  // count is low. The frontend's replenish() already handles that via the
  // POST /generate endpoint. A fire-and-forget here races with it: it deletes
  // the recs the user is viewing, holds the generation lock, and causes the
  // next replenish to return 0.
  if (count === 0) {
    await generateRecommendations(userId);
  }

  // Use cache only after ensuring we have recs
  const cacheKey = `user:${userId}:recommendations:${page}:${pageSize}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached && count > AUTO_REPLENISH_THRESHOLD) return cached;

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
          ratingCount: true,
          metacritic: true,
          releaseDate: true,
          genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
          platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
        },
      },
    },
  });

  const totalPages = Math.ceil(total / pageSize);

  // Determine when recommendations were last generated
  const latestRec = await prisma.recommendation.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

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
        ratingCount: rec.game.ratingCount,
        metacritic: rec.game.metacritic,
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
    latestGeneratedAt: latestRec?.createdAt?.toISOString() ?? null,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.RECOMMENDATIONS);
  return result;
}

/**
 * Dismiss a specific recommendation — permanently records the dismissal
 * so the game will never be recommended again, then removes it from
 * the active recommendations list.
 */
export async function dismissRecommendation(userId: string, recommendationId: string): Promise<void> {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });

  if (!rec || rec.userId !== userId) {
    throw new RecommendationError('Recommendation not found', 404);
  }

  // Persist the dismissal so it survives recommendation regeneration
  await prisma.dismissedRecommendation.upsert({
    where: { userId_gameId: { userId, gameId: rec.gameId } },
    create: { userId, gameId: rec.gameId },
    update: {},
  });

  // Remove from active recommendations
  await prisma.recommendation.delete({ where: { id: recommendationId } });

  // Invalidate caches
  await cacheDel(`user:${userId}:recommendations`);
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);
}

/**
 * Generate more recommendations without clearing dismissals.
 * Used by auto-replenish and background triggers (e.g. library changes).
 */
export async function generateMoreRecommendations(userId: string): Promise<number> {
  // Invalidate cache
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);
  await cacheDel(`user:${userId}:recommendations`);

  return generateRecommendations(userId);
}

/**
 * Force-refresh recommendations for the user.
 * Clears the dismissed list so previously dismissed games are eligible again;
 * a refresh is an intentional "start fresh" action.
 */
export async function resetAndRefreshRecommendations(userId: string): Promise<number> {
  // Clear dismissals — the user wants a fresh set
  await prisma.dismissedRecommendation.deleteMany({ where: { userId } });

  // Invalidate cache
  const r = await import('../lib/redis');
  await r.cacheInvalidatePattern(`user:${userId}:recommendations:*`);
  await cacheDel(`user:${userId}:recommendations`);

  return generateRecommendations(userId);
}

/**
 * Get the current recommendation status for a user.
 * Returns the total non-expired count and whether generation is in progress.
 */
export async function getRecommendationStatus(userId: string) {
  const total = await prisma.recommendation.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });
  return {
    total,
    generating: generationInProgress.has(userId),
  };
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
