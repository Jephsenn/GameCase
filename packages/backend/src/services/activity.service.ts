import prisma from '../lib/prisma';
import { PAGINATION } from '@gamecase/shared';

// ──────────────────────────────────────────────
// Activity Service — social feed
// ──────────────────────────────────────────────

export class ActivityError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ActivityError';
  }
}

const activityInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
    },
  },
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
  library: {
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      isDefault: true,
      defaultType: true,
    },
  },
} as const;

type RawActivity = Awaited<ReturnType<typeof prisma.activityFeedItem.findFirst>> & {
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null };
  game: {
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    backgroundImage: string | null;
    rating: number | null;
    releaseDate: Date | null;
    platforms: { platform: { id: string; name: string; slug: string } }[];
    genres: { genre: { id: string; name: string; slug: string } }[];
  } | null;
  library: { id: string; name: string; slug: string; visibility: string; isDefault: boolean; defaultType: string | null } | null;
};

function formatActivity(item: NonNullable<RawActivity>) {
  return {
    id: item.id,
    user: {
      id: item.user.id,
      username: item.user.username,
      displayName: item.user.displayName,
      avatarUrl: item.user.avatarUrl,
      bio: item.user.bio,
    },
    type: item.type,
    game: item.game
      ? {
          id: item.game.id,
          slug: item.game.slug,
          title: item.game.title,
          coverImage: item.game.coverImage,
          backgroundImage: item.game.backgroundImage,
          rating: item.game.rating,
          releaseDate: item.game.releaseDate?.toISOString() ?? null,
          platforms: item.game.platforms.map((p) => p.platform),
          genres: item.game.genres.map((g) => g.genre),
        }
      : null,
    library: item.library && (item.library.isDefault || item.library.visibility === 'public')
      ? {
          id: item.library.id,
          name: item.library.name,
          slug: item.library.slug,
          isDefault: item.library.isDefault,
          defaultType: item.library.defaultType,
        }
      : null,
    metadata: item.metadata as Record<string, unknown> | null,
    createdAt: item.createdAt.toISOString(),
  };
}

// ── Get My Feed (friends + self) ──────────────

export async function getMyFeed(
  userId: string,
  page: number = PAGINATION.DEFAULT_PAGE,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
) {
  // Get all accepted friend IDs
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { recipientId: userId }],
    },
    select: { requesterId: true, recipientId: true },
  });

  const friendIds = friendships.map((f) =>
    f.requesterId === userId ? f.recipientId : f.requesterId,
  );

  // Include self
  const userIds = [userId, ...friendIds];

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.activityFeedItem.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: activityInclude,
    }),
    prisma.activityFeedItem.count({
      where: { userId: { in: userIds } },
    }),
  ]);

  return {
    items: items.map((item) => formatActivity(item as unknown as NonNullable<RawActivity>)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNext: page * pageSize < total,
    hasPrevious: page > 1,
  };
}

// ── Get User Activity ─────────────────────────

export async function getUserActivity(
  userId: string,
  targetUserId: string,
  page: number = PAGINATION.DEFAULT_PAGE,
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
) {
  // If not self, check friendship
  if (targetUserId !== userId) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, recipientId: targetUserId },
          { requesterId: targetUserId, recipientId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new ActivityError('You must be friends to view this activity', 403);
    }
  }

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.activityFeedItem.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: activityInclude,
    }),
    prisma.activityFeedItem.count({
      where: { userId: targetUserId },
    }),
  ]);

  return {
    items: items.map((item) => formatActivity(item as unknown as NonNullable<RawActivity>)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNext: page * pageSize < total,
    hasPrevious: page > 1,
  };
}
