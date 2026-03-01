import prisma from '../lib/prisma';
import { cacheDel, cacheGet, cacheSet } from '../lib/redis';
import { CACHE_TTL, PAGINATION, LIBRARY } from '@gametracker/shared';
import { slugify } from '@gametracker/shared';

// ──────────────────────────────────────────────
// Library Service — CRUD for libraries & items
// ──────────────────────────────────────────────

export class LibraryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'LibraryError';
  }
}

// ── Library helpers ────────────────────────────

function librarySelect() {
  return {
    id: true,
    name: true,
    slug: true,
    description: true,
    visibility: true,
    isDefault: true,
    defaultType: true,
    sortOrder: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { items: true } },
  } as const;
}

function formatLibrary(lib: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  isDefault: boolean;
  defaultType: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { items: number };
}) {
  return {
    id: lib.id,
    userId: '',
    name: lib.name,
    slug: lib.slug,
    description: lib.description,
    visibility: lib.visibility as 'public' | 'private',
    isDefault: lib.isDefault,
    defaultType: lib.defaultType as 'played' | 'want_to_play' | 'backlog' | 'currently_playing' | null,
    sortOrder: lib.sortOrder,
    itemCount: lib._count.items,
    createdAt: lib.createdAt.toISOString(),
    updatedAt: lib.updatedAt.toISOString(),
  };
}

// ── Get user's libraries ──────────────────────

export async function getUserLibraries(userId: string) {
  const cacheKey = `user:${userId}:libraries`;
  const cached = await cacheGet<ReturnType<typeof formatLibrary>[]>(cacheKey);
  if (cached) return cached;

  const libraries = await prisma.library.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    select: { ...librarySelect(), userId: true },
  });

  const result = libraries.map((lib) => ({
    ...formatLibrary(lib),
    userId: lib.userId,
  }));

  await cacheSet(cacheKey, result, CACHE_TTL.USER_PROFILE);
  return result;
}

// ── Get single library with items ─────────────

export async function getLibraryBySlug(
  userId: string,
  slug: string,
  page: number = 1,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
) {
  const library = await prisma.library.findUnique({
    where: { userId_slug: { userId, slug } },
    select: { ...librarySelect(), userId: true },
  });

  if (!library) throw new LibraryError('Library not found', 404);

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.libraryItem.findMany({
      where: { libraryId: library.id },
      orderBy: { addedAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        notes: true,
        userRating: true,
        sortOrder: true,
        addedAt: true,
        game: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            backgroundImage: true,
            rating: true,
            releaseDate: true,
            platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
            genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
          },
        },
      },
    }),
    prisma.libraryItem.count({ where: { libraryId: library.id } }),
  ]);

  const flatItems = items.map((item) => ({
    id: item.id,
    libraryId: library.id,
    gameId: item.game.id,
    notes: item.notes,
    userRating: item.userRating,
    sortOrder: item.sortOrder,
    addedAt: item.addedAt.toISOString(),
    game: {
      id: item.game.id,
      slug: item.game.slug,
      title: item.game.title,
      coverImage: item.game.coverImage,
      backgroundImage: item.game.backgroundImage,
      rating: item.game.rating,
      releaseDate: item.game.releaseDate?.toISOString() ?? null,
      platforms: item.game.platforms.map((p) => p.platform),
      genres: item.game.genres.map((g) => g.genre),
    },
  }));

  return {
    library: { ...formatLibrary(library), userId: library.userId },
    items: {
      items: flatItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    },
  };
}

// ── Create custom library ─────────────────────

export async function createLibrary(
  userId: string,
  input: { name: string; description?: string; visibility?: 'public' | 'private' },
) {
  // Check limit
  const count = await prisma.library.count({ where: { userId, isDefault: false } });
  if (count >= LIBRARY.MAX_CUSTOM_LIBRARIES) {
    throw new LibraryError(`You can have at most ${LIBRARY.MAX_CUSTOM_LIBRARIES} custom libraries`, 400);
  }

  const slug = slugify(input.name);

  // Check slug uniqueness for this user
  const existing = await prisma.library.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (existing) {
    throw new LibraryError('A library with this name already exists', 409);
  }

  // Next sort order
  const maxSort = await prisma.library.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const library = await prisma.library.create({
    data: {
      userId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      visibility: input.visibility || 'public',
      isDefault: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    select: { ...librarySelect(), userId: true },
  });

  await cacheDel(`user:${userId}:libraries`);

  // Activity feed trigger: library_created
  try {
    await prisma.activityFeedItem.create({
      data: {
        userId,
        type: 'library_created',
        libraryId: library.id,
      },
    });
  } catch { /* non-critical */ }

  return { ...formatLibrary(library), userId: library.userId };
}

// ── Update library ────────────────────────────

export async function updateLibrary(
  userId: string,
  libraryId: string,
  input: { name?: string; description?: string; visibility?: 'public' | 'private' },
) {
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });
  if (!library) throw new LibraryError('Library not found', 404);

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (library.isDefault) {
      throw new LibraryError('Cannot rename default libraries', 400);
    }
    data.name = input.name.trim();
    data.slug = slugify(input.name);

    // Check slug uniqueness
    const existing = await prisma.library.findFirst({
      where: { userId, slug: data.slug as string, id: { not: libraryId } },
    });
    if (existing) {
      throw new LibraryError('A library with this name already exists', 409);
    }
  }

  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }

  if (input.visibility !== undefined) {
    data.visibility = input.visibility;
  }

  const updated = await prisma.library.update({
    where: { id: libraryId },
    data,
    select: { ...librarySelect(), userId: true },
  });

  await cacheDel(`user:${userId}:libraries`);
  return { ...formatLibrary(updated), userId: updated.userId };
}

// ── Delete library ────────────────────────────

export async function deleteLibrary(userId: string, libraryId: string) {
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });
  if (!library) throw new LibraryError('Library not found', 404);
  if (library.isDefault) throw new LibraryError('Cannot delete default libraries', 400);

  await prisma.library.delete({ where: { id: libraryId } });
  await cacheDel(`user:${userId}:libraries`);
}

// ── Add game to library ───────────────────────

export async function addGameToLibrary(
  userId: string,
  libraryId: string,
  gameId: string,
  input?: { notes?: string; userRating?: number },
) {
  // Verify ownership
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });
  if (!library) throw new LibraryError('Library not found', 404);

  // Verify game exists
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new LibraryError('Game not found', 404);

  // Check if already in this library
  const existing = await prisma.libraryItem.findUnique({
    where: { libraryId_gameId: { libraryId, gameId } },
  });
  if (existing) throw new LibraryError('Game is already in this library', 409);

  const item = await prisma.libraryItem.create({
    data: {
      libraryId,
      gameId,
      notes: input?.notes?.trim() || null,
      userRating: input?.userRating ?? null,
    },
    select: {
      id: true,
      notes: true,
      userRating: true,
      sortOrder: true,
      addedAt: true,
      game: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          backgroundImage: true,
          rating: true,
          releaseDate: true,
          platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
          genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
        },
      },
    },
  });

  await cacheDel(`user:${userId}:libraries`);

  // Activity feed trigger: game_added
  try {
    await prisma.activityFeedItem.create({
      data: {
        userId,
        type: 'game_added',
        gameId,
        libraryId,
        libraryItemId: item.id,
      },
    });
  } catch { /* non-critical */ }

  return {
    id: item.id,
    libraryId,
    gameId: item.game.id,
    notes: item.notes,
    userRating: item.userRating,
    sortOrder: item.sortOrder,
    addedAt: item.addedAt.toISOString(),
    game: {
      id: item.game.id,
      slug: item.game.slug,
      title: item.game.title,
      coverImage: item.game.coverImage,
      backgroundImage: item.game.backgroundImage,
      rating: item.game.rating,
      releaseDate: item.game.releaseDate?.toISOString() ?? null,
      platforms: item.game.platforms.map((p) => p.platform),
      genres: item.game.genres.map((g) => g.genre),
    },
  };
}

// ── Update library item (notes, rating) ───────

export async function updateLibraryItem(
  userId: string,
  itemId: string,
  input: { notes?: string; userRating?: number | null },
) {
  // Verify ownership through join
  const item = await prisma.libraryItem.findFirst({
    where: { id: itemId, library: { userId } },
  });
  if (!item) throw new LibraryError('Library item not found', 404);

  const data: Record<string, unknown> = {};
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.userRating !== undefined) data.userRating = input.userRating;

  const updated = await prisma.libraryItem.update({
    where: { id: itemId },
    data,
    select: {
      id: true,
      libraryId: true,
      notes: true,
      userRating: true,
      sortOrder: true,
      addedAt: true,
      game: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          backgroundImage: true,
          rating: true,
          releaseDate: true,
          platforms: { select: { platform: { select: { id: true, name: true, slug: true } } } },
          genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
        },
      },
    },
  });

  await cacheDel(`user:${userId}:libraries`);

  // Activity feed triggers: game_rated and/or game_noted
  try {
    if (input.userRating !== undefined && input.userRating !== item.userRating) {
      await prisma.activityFeedItem.create({
        data: {
          userId,
          type: 'game_rated',
          gameId: item.gameId,
          libraryId: item.libraryId,
          libraryItemId: item.id,
          metadata: { oldRating: item.userRating, newRating: input.userRating },
        },
      });
    }
    if (input.notes !== undefined && input.notes !== item.notes) {
      await prisma.activityFeedItem.create({
        data: {
          userId,
          type: 'game_noted',
          gameId: item.gameId,
          libraryId: item.libraryId,
          libraryItemId: item.id,
        },
      });
    }
  } catch { /* non-critical */ }

  return {
    id: updated.id,
    libraryId: updated.libraryId,
    gameId: updated.game.id,
    notes: updated.notes,
    userRating: updated.userRating,
    sortOrder: updated.sortOrder,
    addedAt: updated.addedAt.toISOString(),
    game: {
      ...updated.game,
      releaseDate: updated.game.releaseDate?.toISOString() ?? null,
      platforms: updated.game.platforms.map((p) => p.platform),
      genres: updated.game.genres.map((g) => g.genre),
    },
  };
}

// ── Remove game from library ──────────────────

export async function removeFromLibrary(userId: string, itemId: string) {
  const item = await prisma.libraryItem.findFirst({
    where: { id: itemId, library: { userId } },
  });
  if (!item) throw new LibraryError('Library item not found', 404);

  await prisma.libraryItem.delete({ where: { id: itemId } });
  await cacheDel(`user:${userId}:libraries`);
}

// ── Move game between libraries ───────────────

export async function moveGameToLibrary(
  userId: string,
  itemId: string,
  targetLibraryId: string,
) {
  const item = await prisma.libraryItem.findFirst({
    where: { id: itemId, library: { userId } },
    select: { id: true, gameId: true, libraryId: true },
  });
  if (!item) throw new LibraryError('Library item not found', 404);

  // Verify target library ownership
  const targetLib = await prisma.library.findFirst({
    where: { id: targetLibraryId, userId },
  });
  if (!targetLib) throw new LibraryError('Target library not found', 404);

  if (item.libraryId === targetLibraryId) return; // already there

  // Check if game already in target
  const existing = await prisma.libraryItem.findUnique({
    where: { libraryId_gameId: { libraryId: targetLibraryId, gameId: item.gameId } },
  });
  if (existing) throw new LibraryError('Game is already in the target library', 409);

  await prisma.libraryItem.update({
    where: { id: itemId },
    data: { libraryId: targetLibraryId },
  });

  await cacheDel(`user:${userId}:libraries`);
}

// ── Check which libraries contain a game ──────

export async function getGameLibraryStatus(userId: string, gameId: string) {
  const items = await prisma.libraryItem.findMany({
    where: { gameId, library: { userId } },
    select: {
      id: true,
      libraryId: true,
      userRating: true,
      notes: true,
      library: { select: { name: true, slug: true, defaultType: true } },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    libraryId: item.libraryId,
    libraryName: item.library.name,
    librarySlug: item.library.slug,
    defaultType: item.library.defaultType,
    userRating: item.userRating,
    notes: item.notes,
  }));
}
