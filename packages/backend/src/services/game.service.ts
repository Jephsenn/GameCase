import prisma from '../lib/prisma';
import {
  searchRawgGames,
  getRawgGameById,
  getRawgGameScreenshots,
  RawgApiError,
  type RawgGameListItem,
  type RawgGameDetail,
  type RawgGamesParams,
} from '../lib/rawg';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../lib/redis';
import { logger } from '../lib/logger';
import { CACHE_TTL, PAGINATION, SEARCH } from '@gametracker/shared';
import type { GameSearchParams } from '@gametracker/shared';

// ──────────────────────────────────────────────
// Game Data Service — ingestion, normalization, search
// ──────────────────────────────────────────────

// ── Helpers ────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Find or create platform by slug/name, returning its id.
 * Handles the case where RAWG returns different slugs for the same platform name.
 */
async function upsertPlatform(name: string, slug: string): Promise<string> {
  // Check by slug first, then by name
  const existing = await prisma.platform.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.platform.create({ data: { name, slug } });
    return created.id;
  } catch {
    // Race condition: another concurrent insert won — just find it
    const found = await prisma.platform.findFirst({
      where: { OR: [{ slug }, { name }] },
    });
    return found!.id;
  }
}

/**
 * Find or create genre by slug/name, returning its id.
 */
async function upsertGenre(name: string, slug: string): Promise<string> {
  const existing = await prisma.genre.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.genre.create({ data: { name, slug } });
    return created.id;
  } catch {
    const found = await prisma.genre.findFirst({
      where: { OR: [{ slug }, { name }] },
    });
    return found!.id;
  }
}

/**
 * Find or create tag by slug/name, returning its id.
 */
async function upsertTag(name: string, slug: string): Promise<string> {
  const existing = await prisma.tag.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.tag.create({ data: { name, slug } });
    return created.id;
  } catch {
    const found = await prisma.tag.findFirst({
      where: { OR: [{ slug }, { name }] },
    });
    return found!.id;
  }
}

// ── Normalization ──────────────────────────────

/**
 * Take a RAWG game payload and upsert it into the local DB, including
 * platforms, genres, tags, and screenshots.
 */
export async function ingestRawgGame(rawg: RawgGameListItem | RawgGameDetail): Promise<string> {
  const slug = rawg.slug || slugify(rawg.name);

  // Upsert the base game record
  const game = await prisma.game.upsert({
    where: { rawgId: rawg.id },
    update: {
      slug,
      title: rawg.name,
      description: 'description_raw' in rawg ? (rawg as RawgGameDetail).description_raw : undefined,
      releaseDate: rawg.released ? new Date(rawg.released) : null,
      rating: rawg.rating || null,
      ratingCount: rawg.ratings_count || null,
      metacritic: rawg.metacritic ?? null,
      backgroundImage: rawg.background_image ?? null,
      coverImage: rawg.background_image ?? null,
      websiteUrl: 'website' in rawg ? (rawg as RawgGameDetail).website : undefined,
      esrbRating: rawg.esrb_rating?.name ?? null,
      playtime: rawg.playtime || null,
    },
    create: {
      rawgId: rawg.id,
      slug,
      title: rawg.name,
      description: 'description_raw' in rawg ? (rawg as RawgGameDetail).description_raw : null,
      releaseDate: rawg.released ? new Date(rawg.released) : null,
      rating: rawg.rating || null,
      ratingCount: rawg.ratings_count || null,
      metacritic: rawg.metacritic ?? null,
      backgroundImage: rawg.background_image ?? null,
      coverImage: rawg.background_image ?? null,
      websiteUrl: 'website' in rawg ? (rawg as RawgGameDetail).website : null,
      esrbRating: rawg.esrb_rating?.name ?? null,
      playtime: rawg.playtime || null,
    },
  });

  // ── Platforms ──
  if (rawg.platforms && rawg.platforms.length > 0) {
    // Delete existing associations, re-create
    await prisma.gamePlatform.deleteMany({ where: { gameId: game.id } });
    for (const p of rawg.platforms) {
      const platformId = await upsertPlatform(p.platform.name, p.platform.slug);
      await prisma.gamePlatform.create({
        data: { gameId: game.id, platformId },
      });
    }
  }

  // ── Genres ──
  if (rawg.genres && rawg.genres.length > 0) {
    await prisma.gameGenre.deleteMany({ where: { gameId: game.id } });
    for (const g of rawg.genres) {
      const genreId = await upsertGenre(g.name, g.slug);
      await prisma.gameGenre.create({
        data: { gameId: game.id, genreId },
      });
    }
  }

  // ── Tags (limit to first 15 to avoid bloat) ──
  if (rawg.tags && rawg.tags.length > 0) {
    await prisma.gameTag.deleteMany({ where: { gameId: game.id } });
    for (const t of rawg.tags.slice(0, 15)) {
      const tagId = await upsertTag(t.name, t.slug);
      await prisma.gameTag.create({
        data: { gameId: game.id, tagId },
      });
    }
  }

  // ── Screenshots from short_screenshots ──
  if (rawg.short_screenshots && rawg.short_screenshots.length > 0) {
    await prisma.gameScreenshot.deleteMany({ where: { gameId: game.id } });
    await prisma.gameScreenshot.createMany({
      data: rawg.short_screenshots.map((s) => ({
        gameId: game.id,
        url: s.image,
      })),
    });
  }

  return game.id;
}

/**
 * Fetch full details + screenshots from RAWG and ingest a single game.
 */
export async function ingestFullGame(rawgId: number): Promise<string> {
  const detail = await getRawgGameById(rawgId);
  const gameId = await ingestRawgGame(detail);

  // Fetch separate screenshots endpoint for higher-res images
  try {
    const screenshotRes = await getRawgGameScreenshots(rawgId);
    if (screenshotRes.results.length > 0) {
      await prisma.gameScreenshot.deleteMany({ where: { gameId } });
      await prisma.gameScreenshot.createMany({
        data: screenshotRes.results.map((s) => ({
          gameId,
          url: s.image,
          width: s.width,
          height: s.height,
        })),
      });
    }
  } catch {
    // screenshots failure is non-fatal
  }

  return gameId;
}

// ── Bulk import ────────────────────────────────

export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

/**
 * Import multiple pages of games from RAWG.
 * Useful for initial seeding or admin reindex.
 */
export async function importGamesFromRawg(
  params: RawgGamesParams = {},
  pages = 5,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };

  for (let page = 1; page <= pages; page++) {
    try {
      const response = await searchRawgGames({ ...params, page, page_size: 40 });

      for (const game of response.results) {
        try {
          await ingestRawgGame(game);
          result.imported++;
        } catch (err) {
          result.failed++;
          result.errors.push(`${game.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      // If there's no next page, break early
      if (!response.next) break;

      // Small delay between pages to respect rate limits
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      if (err instanceof RawgApiError) {
        result.errors.push(`Page ${page}: ${err.message}`);
      }
      break;
    }
  }

  // Invalidate search caches after bulk import
  await cacheInvalidatePattern('games:*');

  return result;
}

// ── Search / Query (local DB + RAWG enrichment) ─────

/**
 * Search game database with optional filtering & pagination.
 * When a text query is provided, results are enriched from RAWG to ensure
 * comprehensive coverage — local DB results appear first, then RAWG fills
 * remaining slots. When browsing without a query (or with filters only),
 * serves from local DB only. Results are cached in Redis.
 */
export async function searchGames(params: GameSearchParams) {
  const page = params.page ?? PAGINATION.DEFAULT_PAGE;
  const pageSize = Math.min(params.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  // Build cache key from params
  const cacheKey = `games:search:${JSON.stringify({ ...params, page, pageSize })}`;
  const cached = await cacheGet<{ items: unknown[]; total: number }>(cacheKey);
  if (cached) {
    return {
      items: cached.items,
      total: cached.total,
      page,
      pageSize,
      totalPages: Math.ceil(cached.total / pageSize),
      hasNext: page * pageSize < cached.total,
      hasPrevious: page > 1,
    };
  }

  // Build where clause
  const where: Record<string, unknown> = {};
  const hasTextQuery = !!(params.query && params.query.length >= SEARCH.MIN_QUERY_LENGTH);
  const hasFilters = (params.genres && params.genres.length > 0) ||
                     (params.platforms && params.platforms.length > 0) ||
                     (params.tags && params.tags.length > 0);

  if (hasTextQuery) {
    where.title = { contains: params.query, mode: 'insensitive' };
  }

  if (params.genres && params.genres.length > 0) {
    where.genres = {
      some: { genre: { slug: { in: params.genres } } },
    };
  }

  if (params.platforms && params.platforms.length > 0) {
    where.platforms = {
      some: { platform: { slug: { in: params.platforms } } },
    };
  }

  if (params.tags && params.tags.length > 0) {
    where.tags = {
      some: { tag: { slug: { in: params.tags } } },
    };
  }

  // Build orderBy
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  let orderBy: Record<string, string>;
  switch (params.sortBy) {
    case 'title':
      orderBy = { title: params.sortOrder === 'desc' ? 'desc' : 'asc' };
      break;
    case 'rating':
      orderBy = { rating: sortOrder };
      break;
    case 'releaseDate':
      orderBy = { releaseDate: sortOrder };
      break;
    case 'metacritic':
      orderBy = { metacritic: sortOrder };
      break;
    case 'popularity':
      orderBy = { ratingCount: sortOrder };
      break;
    default:
      orderBy = { rating: 'desc' };
  }

  const [items, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        backgroundImage: true,
        rating: true,
        ratingCount: true,
        metacritic: true,
        playtime: true,
        esrbRating: true,
        releaseDate: true,
        platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
        genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
      },
    }),
    prisma.game.count({ where }),
  ]);

  // Flatten join-table format
  const flatItems = items.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    coverImage: g.coverImage,
    backgroundImage: g.backgroundImage,
    rating: g.rating,
    ratingCount: g.ratingCount,
    metacritic: g.metacritic,
    playtime: g.playtime,
    esrbRating: g.esrbRating,
    releaseDate: g.releaseDate?.toISOString() ?? null,
    platforms: g.platforms.map((p) => p.platform),
    genres: g.genres.map((ge) => ge.genre),
  }));

  // ── RAWG enrichment ──
  // When a user searches by text (no local-only filters), always query RAWG
  // to supplement results. Local matches appear first, then RAWG fills the
  // rest of the page. This makes the experience seamless — users don't need
  // to know whether a game is in the local DB or not.
  let mergedItems = flatItems;
  let mergedTotal = total;

  if (hasTextQuery && !hasFilters) {
    try {
      const rawgResponse = await searchRawgGames({
        search: params.query!,
        page,
        page_size: pageSize,
      });

      const localSlugs = new Set(flatItems.map((g) => g.slug));
      const rawgExtras = rawgResponse.results
        .filter((g) => !localSlugs.has(g.slug))
        .map((g) => ({
          id: `rawg-${g.id}`,
          slug: g.slug,
          title: g.name,
          coverImage: g.background_image,
          backgroundImage: g.background_image,
          rating: g.rating || null,
          ratingCount: g.ratings_count || null,
          metacritic: g.metacritic ?? null,
          playtime: g.playtime || null,
          esrbRating: g.esrb_rating?.name ?? null,
          releaseDate: g.released,
          platforms: g.platforms?.map((p) => ({
            id: String(p.platform.id),
            name: p.platform.name,
            slug: p.platform.slug,
          })) ?? [],
          genres: g.genres?.map((ge) => ({
            id: String(ge.id),
            name: ge.name,
            slug: ge.slug,
          })) ?? [],
        }));

      // Local results first, then RAWG extras to fill the page
      const slotsAvailable = pageSize - flatItems.length;
      mergedItems = [...flatItems, ...rawgExtras.slice(0, Math.max(0, slotsAvailable))];
      // Cap the total to avoid absurd page counts (RAWG can return 50K+)
      const MAX_SEARCH_TOTAL = 200;
      mergedTotal = Math.min(Math.max(total, rawgResponse.count), MAX_SEARCH_TOTAL);
    } catch (err) {
      // RAWG enrichment is best-effort — if it fails, just return local results
      logger.warn({ err, query: params.query }, 'RAWG enrichment failed for search query');
    }
  }

  const result = { items: mergedItems, total: mergedTotal };
  await cacheSet(cacheKey, result, CACHE_TTL.GAME_SEARCH);

  return {
    ...result,
    page,
    pageSize,
    totalPages: Math.ceil(mergedTotal / pageSize),
    hasNext: page * pageSize < mergedTotal,
    hasPrevious: page > 1,
  };
}

// ── Get single game detail ─────────────────────

/**
 * Get a game by its local id or slug, including all relations.
 * If the game is not in the local DB but `fetchFromRawg` is true,
 * attempt to fetch from RAWG and ingest it.
 */
export async function getGameDetail(idOrSlug: string, fetchFromRawg = false) {
  const cacheKey = `games:detail:${idOrSlug}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  let game = await prisma.game.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
      genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      screenshots: { select: { url: true } },
    },
  });

  // If not found locally, try RAWG
  if (!game && fetchFromRawg) {
    try {
      // Attempt to interpret as RAWG slug
      const rawgDetail = await import('../lib/rawg').then((m) => m.getRawgGameBySlug(idOrSlug));
      await ingestRawgGame(rawgDetail);

      game = await prisma.game.findFirst({
        where: { slug: idOrSlug },
        include: {
          platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
          genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
          screenshots: { select: { url: true } },
        },
      });
    } catch {
      // RAWG fetch failed or game doesn't exist
    }
  }

  if (!game) return null;

  const detail = {
    id: game.id,
    rawgId: game.rawgId,
    slug: game.slug,
    title: game.title,
    description: game.description,
    releaseDate: game.releaseDate?.toISOString() ?? null,
    rating: game.rating,
    ratingCount: game.ratingCount,
    metacritic: game.metacritic,
    backgroundImage: game.backgroundImage,
    coverImage: game.coverImage,
    websiteUrl: game.websiteUrl,
    esrbRating: game.esrbRating,
    playtime: game.playtime,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    platforms: game.platforms.map((p) => p.platform),
    genres: game.genres.map((g) => g.genre),
    tags: game.tags.map((t) => t.tag),
    screenshots: game.screenshots.map((s) => s.url),
  };

  await cacheSet(cacheKey, detail, CACHE_TTL.GAME_DETAIL);
  return detail;
}

// ── External search (proxied through RAWG) ─────

/**
 * Search RAWG directly (for "discover new games" feature).
 * Results are cached briefly and NOT ingested automatically.
 */
export async function discoverGames(query: string, page = 1, pageSize = 20) {
  const cacheKey = `games:discover:${query}:${page}:${pageSize}`;
  const cached = await cacheGet<{ items: unknown[]; total: number }>(cacheKey);
  if (cached) {
    return {
      ...cached,
      page,
      pageSize,
      totalPages: Math.ceil(cached.total / pageSize),
      hasNext: page * pageSize < cached.total,
      hasPrevious: page > 1,
    };
  }

  const response = await searchRawgGames({
    search: query,
    page,
    page_size: pageSize,
  });

  const items = response.results.map((g) => ({
    rawgId: g.id,
    slug: g.slug,
    title: g.name,
    coverImage: g.background_image,
    backgroundImage: g.background_image,
    rating: g.rating || null,
    ratingCount: g.ratings_count || null,
    metacritic: g.metacritic ?? null,
    playtime: g.playtime || null,
    esrbRating: g.esrb_rating?.name ?? null,
    releaseDate: g.released,
    platforms: g.platforms?.map((p) => ({
      id: String(p.platform.id),
      name: p.platform.name,
      slug: p.platform.slug,
    })) ?? [],
    genres: g.genres?.map((ge) => ({
      id: String(ge.id),
      name: ge.name,
      slug: ge.slug,
    })) ?? [],
  }));

  const result = { items, total: response.count };
  await cacheSet(cacheKey, result, CACHE_TTL.GAME_SEARCH);

  return {
    ...result,
    page,
    pageSize,
    totalPages: Math.ceil(response.count / pageSize),
    hasNext: !!response.next,
    hasPrevious: page > 1,
  };
}

/**
 * Get available platforms from local DB (cached).
 */
export async function getPlatforms() {
  const cacheKey = 'ref:platforms';
  const cached = await cacheGet<{ id: string; name: string; slug: string }[]>(cacheKey);
  if (cached) return cached;

  const platforms = await prisma.platform.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  await cacheSet(cacheKey, platforms, CACHE_TTL.PLATFORMS);
  return platforms;
}

/**
 * Get available genres from local DB (cached).
 */
export async function getGenres() {
  const cacheKey = 'ref:genres';
  const cached = await cacheGet<{ id: string; name: string; slug: string }[]>(cacheKey);
  if (cached) return cached;

  const genres = await prisma.genre.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  await cacheSet(cacheKey, genres, CACHE_TTL.GENRES);
  return genres;
}
