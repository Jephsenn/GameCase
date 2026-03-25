import client from './client';
import type { ApiResponse, GameListItem } from '@gamecase/shared';

// ── Types ────────────────────────────────────────────

export interface Library {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  isDefault: boolean;
  defaultType: 'played' | 'want_to_play' | 'backlog' | 'currently_playing' | null;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  libraryId: string;
  notes: string | null;
  userRating: number | null; // 0–5
  platformsPlayed: string[];
  addedAt: string;
  game: GameListItem;
}

// Raw shape returned by the backend
interface LibraryDetailRaw {
  library: Library;
  items: {
    items: LibraryItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Normalized shape used by the mobile app
export interface LibraryDetailResponse {
  library: Library;
  items: LibraryItem[];
  total: number;
  page: number;
  totalPages: number;
}

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

export interface GetLibraryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'added' | 'title' | 'rating' | 'release';
  sortOrder?: 'asc' | 'desc';
  genres?: string;
  platforms?: string;
  ratingFilter?: 'rated' | 'unrated';
}

// ── Library (collection) endpoints ──────────────────

export async function getLibraries() {
  const { data } = await client.get<ApiResponse<Library[]>>('/libraries');
  return data.data;
}

export async function getLibraryBySlug(slug: string, opts: GetLibraryOptions = {}): Promise<LibraryDetailResponse> {
  const { data } = await client.get<ApiResponse<LibraryDetailRaw>>(
    `/libraries/${slug}`,
    { params: opts },
  );
  const raw = data.data;
  // Normalize the nested pagination wrapper into a flat structure
  return {
    library: raw.library,
    items: raw.items.items,
    total: raw.items.total,
    page: raw.items.page,
    totalPages: raw.items.totalPages,
  };
}

export async function createLibrary(payload: {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
}) {
  const { data } = await client.post<ApiResponse<Library>>('/libraries', payload);
  return data.data;
}

export async function updateLibrary(
  id: string,
  payload: { name?: string; description?: string; visibility?: 'public' | 'private' },
) {
  const { data } = await client.patch<ApiResponse<Library>>(`/libraries/${id}`, payload);
  return data.data;
}

export async function deleteLibrary(id: string) {
  const { data } = await client.delete<ApiResponse<{ message: string }>>(`/libraries/${id}`);
  return data.data;
}

// ── Library item endpoints ───────────────────────────

export async function addGameToLibrary(
  libraryId: string,
  payload: {
    gameId: string;
    notes?: string;
    userRating?: number;
    platformsPlayed?: string[];
  },
) {
  const { data } = await client.post<ApiResponse<LibraryItem>>(
    `/libraries/${libraryId}/items`,
    payload,
  );
  return data.data;
}

export async function updateLibraryItem(
  itemId: string,
  payload: {
    notes?: string;
    userRating?: number | null;
    platformsPlayed?: string[];
  },
) {
  const { data } = await client.patch<ApiResponse<LibraryItem>>(
    `/libraries/items/${itemId}`,
    payload,
  );
  return data.data;
}

export async function removeFromLibrary(itemId: string) {
  const { data } = await client.delete<ApiResponse<{ message: string }>>(
    `/libraries/items/${itemId}`,
  );
  return data.data;
}

export async function moveGameToLibrary(itemId: string, targetLibraryId: string) {
  const { data } = await client.post<ApiResponse<{ message: string }>>(
    `/libraries/items/${itemId}/move`,
    { targetLibraryId },
  );
  return data.data;
}

export async function getGameLibraryStatus(gameId: string) {
  const { data } = await client.get<
    ApiResponse<{ libraries: { libraryId: string; libraryName: string; itemId: string }[] }>
  >(`/libraries/game-status/${gameId}`);
  return data.data;
}

// ── Stats ────────────────────────────────────────────

export async function getUserStats() {
  const { data } = await client.get<ApiResponse<UserStats>>('/users/stats');
  return data.data;
}
