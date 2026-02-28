// ──────────────────────────────────────────────
// Application constants — portable, no runtime deps
// ──────────────────────────────────────────────

/** Default libraries created for every new user */
export const DEFAULT_LIBRARIES = [
  { name: 'Played', slug: 'played', defaultType: 'played' as const, sortOrder: 0 },
  {
    name: 'Currently Playing',
    slug: 'currently-playing',
    defaultType: 'currently_playing' as const,
    sortOrder: 1,
  },
  {
    name: 'Want to Play',
    slug: 'want-to-play',
    defaultType: 'want_to_play' as const,
    sortOrder: 2,
  },
  { name: 'Backlog', slug: 'backlog', defaultType: 'backlog' as const, sortOrder: 3 },
] as const;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Game rating bounds */
export const RATING = {
  MIN: 0,
  MAX: 5,
  STEP: 0.5,
} as const;

/** Username constraints */
export const USERNAME = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  PATTERN: /^[a-zA-Z0-9_-]+$/,
} as const;

/** Password constraints */
export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
} as const;

/** Library constraints */
export const LIBRARY = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_CUSTOM_LIBRARIES: 50,
} as const;

/** Search constraints */
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 200,
} as const;

/** Cache TTL values in seconds */
export const CACHE_TTL = {
  GAME_DETAIL: 3600, // 1 hour
  GAME_LIST: 1800, // 30 min
  GAME_SEARCH: 600, // 10 min
  RECOMMENDATIONS: 3600, // 1 hour
  USER_PROFILE: 300, // 5 min
  PLATFORMS: 86400, // 24 hours
  GENRES: 86400, // 24 hours
} as const;

/** Supported OAuth providers */
export const OAUTH_PROVIDERS = ['google', 'apple'] as const;

/** ESRB Ratings */
export const ESRB_RATINGS = [
  'Everyone',
  'Everyone 10+',
  'Teen',
  'Mature',
  'Adults Only',
  'Rating Pending',
] as const;
