import prisma from '../lib/prisma';
import { AppError } from './auth.service';

interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

// ── Get Profile ───────────────────────────────────────

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      plan: true,
      onboardingDone: true,
      steamId: true,
      steamPlayerName: true,
      steamAvatarUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { libraries: true },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  return {
    ...user,
    libraryCount: user._count.libraries,
    _count: undefined,
  };
}

// ── Get Public Profile ────────────────────────────────

export async function getPublicProfile(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      libraries: {
        where: { visibility: 'public' },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { items: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  const publicLibraries = user.libraries.map((lib) => ({
    ...lib,
    itemCount: lib._count.items,
    _count: undefined,
  }));

  const totalGamesTracked = publicLibraries.reduce((sum, lib) => sum + lib.itemCount, 0);

  return {
    ...user,
    libraryCount: publicLibraries.length,
    totalGamesTracked,
    libraries: publicLibraries,
  };
}

// ── Update Profile ────────────────────────────────────

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      plan: true,
      onboardingDone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

// ── Complete Onboarding ───────────────────────────────

export async function completeOnboarding(
  userId: string,
  favoriteGenreIds: string[],
) {
  // Verify genres exist
  const genres = await prisma.genre.findMany({
    where: { id: { in: favoriteGenreIds } },
  });

  if (genres.length === 0) {
    throw new AppError('Please select at least one genre', 400);
  }

  // Mark onboarding complete
  const user = await prisma.user.update({
    where: { id: userId },
    data: { onboardingDone: true },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      plan: true,
      onboardingDone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { user, selectedGenres: genres };
}

// ── Get all genres (for onboarding picker) ────────────

export async function getAllGenres() {
  return prisma.genre.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}
