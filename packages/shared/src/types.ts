// ──────────────────────────────────────────────
// User types
// ──────────────────────────────────────────────

export type OAuthProvider = 'google' | 'apple';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  oauthProvider: OAuthProvider | null;
  oauthProviderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

// ──────────────────────────────────────────────
// Game types
// ──────────────────────────────────────────────

export interface Game {
  id: string;
  rawgId: number | null;
  slug: string;
  title: string;
  description: string | null;
  releaseDate: string | null;
  rating: number | null;
  ratingCount: number | null;
  metacritic: number | null;
  backgroundImage: string | null;
  coverImage: string | null;
  websiteUrl: string | null;
  esrbRating: string | null;
  playtime: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameListItem {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  backgroundImage: string | null;
  rating: number | null;
  releaseDate: string | null;
  platforms: PlatformInfo[];
  genres: GenreInfo[];
}

export interface GameDetail extends Game {
  platforms: PlatformInfo[];
  genres: GenreInfo[];
  tags: TagInfo[];
  screenshots: string[];
}

// ──────────────────────────────────────────────
// Platform / Genre / Tag
// ──────────────────────────────────────────────

export interface PlatformInfo {
  id: string;
  name: string;
  slug: string;
}

export interface GenreInfo {
  id: string;
  name: string;
  slug: string;
}

export interface TagInfo {
  id: string;
  name: string;
  slug: string;
}

// ──────────────────────────────────────────────
// Library types
// ──────────────────────────────────────────────

export type LibraryVisibility = 'public' | 'private';

export type DefaultLibraryType = 'played' | 'want_to_play' | 'backlog' | 'currently_playing';

export interface Library {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: LibraryVisibility;
  isDefault: boolean;
  defaultType: DefaultLibraryType | null;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  libraryId: string;
  gameId: string;
  notes: string | null;
  userRating: number | null;
  sortOrder: number;
  addedAt: string;
  game: GameListItem;
}

// ──────────────────────────────────────────────
// Recommendation types
// ──────────────────────────────────────────────

export type RecommendationReason = 'genre' | 'tag' | 'collaborative' | 'popular' | 'new_release';

export interface Recommendation {
  id: string;
  game: GameListItem;
  score: number;
  reasons: RecommendationReason[];
  reasonText: string;
}

// ──────────────────────────────────────────────
// API types
// ──────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface GameSearchParams extends PaginationParams {
  query?: string;
  genres?: string[];
  platforms?: string[];
  tags?: string[];
  sortBy?: 'title' | 'rating' | 'releaseDate' | 'metacritic' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

/** Result from a RAWG discover search (not yet in local DB) */
export interface DiscoverGameItem {
  rawgId: number;
  slug: string;
  title: string;
  backgroundImage: string | null;
  rating: number | null;
  releaseDate: string | null;
  platforms: PlatformInfo[];
  genres: GenreInfo[];
}

/** Result from a bulk import operation */
export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

// ──────────────────────────────────────────────
// Auth types
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Friendship types
// ──────────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface FriendRequest {
  id: string;
  requester: UserPublicProfile;
  recipient: UserPublicProfile;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Activity Feed types
// ──────────────────────────────────────────────

export type ActivityType = 'game_added' | 'game_rated' | 'game_noted' | 'library_created';

export interface ActivityFeedItem {
  id: string;
  user: UserPublicProfile;
  type: ActivityType;
  game: GameListItem | null;
  library: { id: string; name: string; slug: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Auth types
// ──────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
