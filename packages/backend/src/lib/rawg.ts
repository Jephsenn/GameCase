import { config } from '../config';

// ──────────────────────────────────────────────
// RAWG API Client — typed HTTP wrapper
// ──────────────────────────────────────────────

/** RAWG "short" result returned in list/search endpoints */
export interface RawgGameListItem {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  playtime: number;
  esrb_rating: { name: string } | null;
  platforms: { platform: { id: number; name: string; slug: string } }[] | null;
  genres: { id: number; name: string; slug: string }[] | null;
  tags: { id: number; name: string; slug: string }[] | null;
  short_screenshots: { id: number; image: string }[] | null;
}

/** RAWG full game detail */
export interface RawgGameDetail extends RawgGameListItem {
  name_original: string;
  description_raw: string | null;
  website: string | null;
}

/** RAWG paginated response wrapper */
export interface RawgPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Parameters for the /games endpoint */
export interface RawgGamesParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_precise?: boolean;
  ordering?: string;
  dates?: string; // e.g. "2024-01-01,2024-12-31"
  genres?: string; // comma-separated ids or slugs
  platforms?: string; // comma-separated ids
  tags?: string; // comma-separated ids or slugs
  metacritic?: string; // e.g. "80,100"
}

class RawgApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'RawgApiError';
  }
}

/**
 * Build a query-string from an object, filtering out undefined/null values.
 */
function buildQs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

async function rawgFetch<T>(path: string, params: Record<string, string | number | boolean | undefined | null> = {}): Promise<T> {
  const apiKey = config.rawgApiKey;
  if (!apiKey) {
    throw new RawgApiError(500, 'RAWG_API_KEY is not configured');
  }

  const url = `${config.rawgBaseUrl}${path}${buildQs({ ...params, key: apiKey })}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GameTracker/1.0' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new RawgApiError(res.status, `RAWG API ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

// ── Public API ──────────────────────────────────────────

/**
 * Search / list games from RAWG.
 */
export async function searchRawgGames(
  params: RawgGamesParams = {},
): Promise<RawgPaginatedResponse<RawgGameListItem>> {
  return rawgFetch<RawgPaginatedResponse<RawgGameListItem>>('/games', {
    page: params.page,
    page_size: params.page_size ?? 20,
    search: params.search,
    search_precise: params.search_precise,
    ordering: params.ordering,
    dates: params.dates,
    genres: params.genres,
    platforms: params.platforms,
    tags: params.tags,
    metacritic: params.metacritic,
  });
}

/**
 * Get a single game's full details from RAWG by its RAWG id.
 */
export async function getRawgGameById(rawgId: number): Promise<RawgGameDetail> {
  return rawgFetch<RawgGameDetail>(`/games/${rawgId}`);
}

/**
 * Get a single game's full details from RAWG by slug.
 */
export async function getRawgGameBySlug(slug: string): Promise<RawgGameDetail> {
  return rawgFetch<RawgGameDetail>(`/games/${encodeURIComponent(slug)}`);
}

/**
 * Get screenshots for a game (RAWG provides a separate endpoint).
 */
export async function getRawgGameScreenshots(
  rawgId: number,
  page = 1,
): Promise<RawgPaginatedResponse<{ id: number; image: string; width: number; height: number }>> {
  return rawgFetch(`/games/${rawgId}/screenshots`, { page, page_size: 20 });
}

export { RawgApiError };
