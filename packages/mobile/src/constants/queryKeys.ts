// ── TanStack Query Key Factories ─────────────────
// Usage: queryKey: queryKeys.games.search(params)

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  games: {
    all: ['games'] as const,
    search: (params: Record<string, unknown>) =>
      ['games', 'search', params] as const,
    discover: (query: string) => ['games', 'discover', query] as const,
    detail: (slug: string) => ['games', 'detail', slug] as const,
    platforms: ['games', 'platforms'] as const,
    genres: ['games', 'genres'] as const,
  },
  libraries: {
    all: ['libraries'] as const,
    detail: (slug: string) => ['libraries', 'detail', slug] as const,
    gameStatus: (gameId: string) =>
      ['libraries', 'game-status', gameId] as const,
  },
  friends: {
    all: ['friends'] as const,
    pending: ['friends', 'pending'] as const,
    sent: ['friends', 'sent'] as const,
    status: (username: string) => ['friends', 'status', username] as const,
  },
  activity: {
    my: ['activity', 'my'] as const,
    friends: ['activity', 'friends'] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
  },
  steam: {
    account: ['steam', 'account'] as const,
    games: ['steam', 'games'] as const,
  },
  users: {
    search: (query: string) => ['users', 'search', query] as const,
    profile: (username: string) => ['users', 'profile', username] as const,
  },
  billing: {
    status: ['billing', 'status'] as const,
  },
} as const;
