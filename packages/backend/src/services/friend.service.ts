import prisma from '../lib/prisma';
import type { FriendshipStatus } from '@gametracker/shared';
import { PLAN_LIMITS } from '@gametracker/shared';
import { AppError } from './auth.service';

// ──────────────────────────────────────────────
// Friend Service — friend requests & management
// ──────────────────────────────────────────────

export class FriendError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FriendError';
  }
}

function formatUserPublic(user: {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
}

function formatFriendship(friendship: {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  requester: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null };
  recipient: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null };
}) {
  return {
    id: friendship.id,
    requester: formatUserPublic(friendship.requester),
    recipient: formatUserPublic(friendship.recipient),
    status: friendship.status as FriendshipStatus,
    createdAt: friendship.createdAt.toISOString(),
    updatedAt: friendship.updatedAt.toISOString(),
  };
}

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
} as const;

// ── Send Friend Request ───────────────────────

export async function sendFriendRequest(userId: string, recipientUsername: string) {
  const recipient = await prisma.user.findUnique({
    where: { username: recipientUsername.toLowerCase() },
    select: { id: true },
  });

  if (!recipient) throw new FriendError('User not found', 404);
  if (recipient.id === userId) throw new FriendError('You cannot send a friend request to yourself', 400);

  // Check for any existing relationship in either direction
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, recipientId: recipient.id },
        { requesterId: recipient.id, recipientId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'accepted') throw new FriendError('You are already friends', 409);
    if (existing.status === 'pending') throw new FriendError('A friend request already exists', 409);
    if (existing.status === 'blocked') throw new FriendError('Unable to send friend request', 403);
    // If declined, allow re-sending by deleting old record
    if (existing.status === 'declined') {
      await prisma.friendship.delete({ where: { id: existing.id } });
    }
  }

  const friendship = await prisma.friendship.create({
    data: {
      requesterId: userId,
      recipientId: recipient.id,
      status: 'pending',
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  return formatFriendship(friendship);
}

// ── Respond to Friend Request ─────────────────

export async function respondToRequest(
  userId: string,
  friendshipId: string,
  action: 'accept' | 'decline',
) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  if (!friendship) throw new FriendError('Friend request not found', 404);
  if (friendship.recipientId !== userId) throw new FriendError('Only the recipient can respond to this request', 403);
  if (friendship.status !== 'pending') throw new FriendError('This request has already been responded to', 400);

  // Check friend limit when accepting
  if (action === 'accept') {
    const recipientUser = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const plan = (recipientUser?.plan === 'pro' ? 'pro' : 'free') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan];
    const acceptedCount = await prisma.friendship.count({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
    });
    if (acceptedCount >= limits.maxFriends) {
      throw new AppError(
        `Free plan is limited to ${limits.maxFriends} friends. Upgrade to Pro for unlimited friends.`,
        403,
      );
    }
  }

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: action === 'accept' ? 'accepted' : 'declined' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  return formatFriendship(updated);
}

// ── Remove Friend ─────────────────────────────

export async function removeFriend(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) throw new FriendError('Friendship not found', 404);
  if (friendship.requesterId !== userId && friendship.recipientId !== userId) {
    throw new FriendError('Not authorized', 403);
  }
  if (friendship.status !== 'accepted') {
    throw new FriendError('This is not an accepted friendship', 400);
  }

  await prisma.friendship.delete({ where: { id: friendshipId } });
}

// ── Block User ────────────────────────────────

export async function blockUser(userId: string, targetUserId: string) {
  if (userId === targetUserId) throw new FriendError('You cannot block yourself', 400);

  // Check target user exists
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) throw new FriendError('User not found', 404);

  // Upsert — if there's an existing relationship in either direction, update it
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    },
  });

  if (existing) {
    // Delete the existing one, then create a new one with the blocker as requester
    await prisma.friendship.delete({ where: { id: existing.id } });
  }

  await prisma.friendship.create({
    data: {
      requesterId: userId,
      recipientId: targetUserId,
      status: 'blocked',
    },
  });
}

// ── Get Accepted Friends ──────────────────────

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { recipientId: userId }],
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return friendships.map((f) => {
    const friend = f.requesterId === userId ? f.recipient : f.requester;
    return {
      friendshipId: f.id,
      ...formatUserPublic(friend),
    };
  });
}

// ── Get Pending (Incoming) Requests ───────────

export async function getPendingRequests(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { recipientId: userId, status: 'pending' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  return friendships.map(formatFriendship);
}

// ── Get Sent (Outgoing) Requests ──────────────

export async function getSentRequests(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { requesterId: userId, status: 'pending' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  return friendships.map(formatFriendship);
}

// ── Get Friendship Status ─────────────────────

export async function getFriendshipStatus(userId: string, targetUserId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  if (!friendship) return null;

  return formatFriendship(friendship);
}
