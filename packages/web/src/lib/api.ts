const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'gt_access_token';

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Token refresh interception ────────────────────
// Allows the auth context to register a callback so the request layer can
// notify React state when a silent token refresh succeeds mid-session.
type TokenRefreshedCallback = (newToken: string) => void;
let onTokenRefreshed: TokenRefreshedCallback | null = null;

export function registerTokenRefreshCallback(cb: TokenRefreshedCallback) {
  onTokenRefreshed = cb;
}

// Serialise concurrent refresh attempts into a single in-flight promise so
// multiple 401s don't all try to hit /auth/refresh simultaneously.
let refreshPromise: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const newToken: string = json?.data?.accessToken;
      if (!newToken) return null;
      localStorage.setItem(TOKEN_KEY, newToken);
      onTokenRefreshed?.(newToken);
      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...fetchOptions } = options;

  const buildHeaders = (t?: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  const doFetch = (t?: string) =>
    fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers: buildHeaders(t),
      credentials: 'include',
    });

  let response = await doFetch(token);

  // On 401 with a token, attempt a silent refresh and retry once
  if (response.status === 401 && token) {
    const newToken = await silentRefresh();
    if (newToken) {
      response = await doFetch(newToken);
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || 'An error occurred',
      response.status,
      data.details,
    );
  }

  return data.data as T;
}

// ── Auth API ─────────────────────────────────────

export interface AuthResponseData {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    onboardingDone: boolean;
    createdAt: string;
    updatedAt: string;
  };
  accessToken: string;
}

export const authApi = {
  signup: (body: { email: string; username: string; password: string; displayName?: string }) =>
    request<AuthResponseData>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  oauth: (body: { token: string; provider: 'google' | 'apple' }) =>
    request<AuthResponseData>('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  refresh: () =>
    request<AuthResponseData>('/auth/refresh', {
      method: 'POST',
    }),

  logout: (token: string) =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
      token,
    }),

  me: (token: string) =>
    request<{ user: AuthResponseData['user'] }>('/auth/me', {
      token,
    }),
};

// ── User API ─────────────────────────────────────

export interface GenreData {
  id: string;
  name: string;
  slug: string;
}

export const userApi = {
  getProfile: (token: string) =>
    request<{ user: AuthResponseData['user'] }>('/users/profile', { token }),

  updateProfile: (token: string, body: { displayName?: string; bio?: string }) =>
    request<{ user: AuthResponseData['user'] }>('/users/profile', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  getPublicProfile: (username: string) =>
    request<{ user: Record<string, unknown> }>(`/users/${username}`),

  getOnboardingGenres: () =>
    request<{ genres: GenreData[] }>('/users/onboarding/genres'),

  completeOnboarding: (token: string, genreIds: string[]) =>
    request<{ user: AuthResponseData['user']; selectedGenres: GenreData[] }>(
      '/users/onboarding/complete',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ genreIds }),
      },
    ),
};

// ── Game API ─────────────────────────────────────

export interface GameListItem {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  backgroundImage: string | null;
  rating: number | null;
  ratingCount: number | null;
  metacritic: number | null;
  playtime: number | null;
  esrbRating: string | null;
  releaseDate: string | null;
  platforms: { id: string; name: string; slug: string }[];
  genres: { id: string; name: string; slug: string }[];
}

export interface GameDetail extends GameListItem {
  rawgId: number | null;
  description: string | null;
  websiteUrl: string | null;
  tags: { id: string; name: string; slug: string }[];
  screenshots: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const gameApi = {
  search: (token: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<PaginatedData<GameListItem>>(`/games${qs ? '?' + qs : ''}`, { token });
  },

  getDetail: (idOrSlug: string, token?: string) =>
    request<GameDetail>(`/games/${encodeURIComponent(idOrSlug)}`, { token }),

  discover: (token: string, query: string, page = 1) =>
    request<PaginatedData<GameListItem & { rawgId: number }>>(`/games/discover?q=${encodeURIComponent(query)}&page=${page}`, { token }),

  getPlatforms: () =>
    request<{ id: string; name: string; slug: string }[]>('/games/platforms'),

  getGenres: () =>
    request<{ id: string; name: string; slug: string }[]>('/games/genres'),

  ingest: (token: string, rawgId: number) =>
    request<GameDetail>(`/games/ingest/${rawgId}`, { method: 'POST', token }),
};

// ── Library API ──────────────────────────────────

export interface LibraryData {
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

export interface LibraryItemData {
  id: string;
  libraryId: string;
  gameId: string;
  notes: string | null;
  userRating: number | null;
  sortOrder: number;
  addedAt: string;
  game: GameListItem;
}

export interface GameLibraryStatus {
  itemId: string;
  libraryId: string;
  libraryName: string;
  librarySlug: string;
  defaultType: string | null;
  userRating: number | null;
  notes: string | null;
}

export const libraryApi = {
  getAll: (token: string) =>
    request<LibraryData[]>('/libraries', { token }),

  getBySlug: (token: string, slug: string, page = 1, pageSize = 20) =>
    request<{ library: LibraryData; items: PaginatedData<LibraryItemData> }>(
      `/libraries/${encodeURIComponent(slug)}?page=${page}&pageSize=${pageSize}`,
      { token },
    ),

  create: (token: string, body: { name: string; description?: string; visibility?: 'public' | 'private' }) =>
    request<LibraryData>('/libraries', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  update: (token: string, id: string, body: { name?: string; description?: string; visibility?: 'public' | 'private' }) =>
    request<LibraryData>(`/libraries/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  delete: (token: string, id: string) =>
    request<{ message: string }>(`/libraries/${id}`, {
      method: 'DELETE',
      token,
    }),

  addGame: (token: string, libraryId: string, gameId: string, opts?: { notes?: string; userRating?: number }) =>
    request<LibraryItemData>(`/libraries/${libraryId}/items`, {
      method: 'POST',
      token,
      body: JSON.stringify({ gameId, ...opts }),
    }),

  updateItem: (token: string, itemId: string, body: { notes?: string; userRating?: number | null }) =>
    request<LibraryItemData>(`/libraries/items/${itemId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  removeItem: (token: string, itemId: string) =>
    request<{ message: string }>(`/libraries/items/${itemId}`, {
      method: 'DELETE',
      token,
    }),

  moveItem: (token: string, itemId: string, targetLibraryId: string) =>
    request<{ message: string }>(`/libraries/items/${itemId}/move`, {
      method: 'POST',
      token,
      body: JSON.stringify({ targetLibraryId }),
    }),

  getGameStatus: (token: string, gameId: string) =>
    request<GameLibraryStatus[]>(`/libraries/game-status/${gameId}`, { token }),
};

// ── Recommendation API ───────────────────────

export interface RecommendationItem {
  id: string;
  score: number;
  reasons: string[];
  reasonText: string;
  game: GameListItem;
}

export const recommendationApi = {
  getAll: (token: string, page = 1, pageSize = 20) =>
    request<PaginatedData<RecommendationItem>>(
      `/recommendations?page=${page}&pageSize=${pageSize}`,
      { token },
    ),

  refresh: (token: string) =>
    request<{ count: number; message: string }>('/recommendations/refresh', {
      method: 'POST',
      token,
    }),

  dismiss: (token: string, id: string) =>
    request<{ message: string }>(`/recommendations/${id}`, {
      method: 'DELETE',
      token,
    }),
};

export { ApiError };
