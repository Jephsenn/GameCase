import client from './client';
import type {
  GameListItem,
  GameDetail,
  PlatformInfo,
  GenreInfo,
  PaginatedResponse,
  ApiResponse,
  GameSearchParams,
  DiscoverGameItem,
  DefaultLibraryType,
} from '@gamecase/shared';

// ── Search / Browse Games (local DB) ─────────────────

export async function searchGames(params: GameSearchParams) {
  const { data } = await client.get<ApiResponse<PaginatedResponse<GameListItem>>>('/games', {
    params: {
      q: params.query,
      genres: params.genres?.join(','),
      platforms: params.platforms?.join(','),
      tags: params.tags?.join(','),
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  return data.data;
}

// ── Discover Games (RAWG proxy) ──────────────────────

export async function discoverGames(params: {
  q: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await client.get<
    ApiResponse<PaginatedResponse<DiscoverGameItem>>
  >('/games/discover', { params });
  return data.data;
}

// ── Game Detail ──────────────────────────────────────

export async function getGameDetail(slug: string) {
  const { data } = await client.get<ApiResponse<GameDetail>>(`/games/${slug}`);
  return data.data;
}

// ── Similar Games (via RAWG tags/genres — discover) ──

export async function getSimilarGames(slug: string) {
  // The backend doesn't have a dedicated similar endpoint.
  // We fetch the game detail first, then discover games in the same genre.
  const detail = await getGameDetail(slug);
  if (!detail || detail.genres.length === 0) return [];

  const primaryGenre = detail.genres[0].slug;
  const result = await searchGames({
    genres: [primaryGenre],
    sortBy: 'rating',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10,
  });
  // Filter out the current game
  return result.items.filter((g) => g.slug !== slug);
}

// ── Platforms & Genres ───────────────────────────────

export async function getPlatforms() {
  const { data } = await client.get<ApiResponse<PlatformInfo[]>>('/games/platforms');
  return data.data;
}

export async function getGenres() {
  const { data } = await client.get<ApiResponse<GenreInfo[]>>('/games/genres');
  return data.data;
}

// ── Library Game Status ──────────────────────────────

export interface GameLibraryStatusItem {
  itemId: string;
  libraryId: string;
  libraryName: string;
  librarySlug: string;
  defaultType: DefaultLibraryType | null;
  userRating: number | null;
  notes: string | null;
  platformsPlayed: string[];
  steamImport: boolean;
}

export async function getGameLibraryStatus(gameId: string) {
  const { data } = await client.get<ApiResponse<GameLibraryStatusItem[]>>(
    `/libraries/game-status/${gameId}`,
  );
  return data.data;
}

// ── Add Game to Library ──────────────────────────────

export async function addGameToLibrary(
  libraryId: string,
  gameId: string,
  opts?: { notes?: string; userRating?: number; platformsPlayed?: string[] },
) {
  const { data } = await client.post<ApiResponse<unknown>>(
    `/libraries/${libraryId}/items`,
    { gameId, ...opts },
  );
  return data.data;
}
