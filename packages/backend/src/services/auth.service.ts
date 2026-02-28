import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { generateTokens, verifyRefreshToken } from '../lib/jwt';
import { DEFAULT_LIBRARIES } from '@gametracker/shared';

interface SignupInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface OAuthInput {
  email: string;
  provider: 'google' | 'apple';
  providerId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    onboardingDone: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Create default libraries for a new user.
 */
async function createDefaultLibraries(userId: string) {
  await prisma.library.createMany({
    data: DEFAULT_LIBRARIES.map((lib) => ({
      userId,
      name: lib.name,
      slug: lib.slug,
      defaultType: lib.defaultType,
      isDefault: true,
      visibility: 'public',
      sortOrder: lib.sortOrder,
    })),
  });
}

/**
 * Strip sensitive fields from user record.
 */
function sanitizeUser(user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    onboardingDone: user.onboardingDone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ── Signup ────────────────────────────────────────────

export async function signup(input: SignupInput): Promise<AuthResult> {
  const { email, username, password, displayName } = input;

  // Check existing
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] },
  });

  if (existing) {
    if (existing.email === email.toLowerCase()) {
      throw new AppError('An account with this email already exists', 409);
    }
    throw new AppError('This username is already taken', 409);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      displayName: displayName || username,
      passwordHash,
    },
  });

  await createDefaultLibraries(user.id);

  const tokens = generateTokens(user.id, user.email);

  // Store refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

// ── Login ─────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = generateTokens(user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

// ── OAuth Login/Signup ────────────────────────────────

export async function oauthLogin(input: OAuthInput): Promise<AuthResult> {
  const { email, provider, providerId, displayName, avatarUrl } = input;

  // Try to find existing OAuth user
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { oauthProvider: provider, oauthProviderId: providerId },
        { email: email.toLowerCase() },
      ],
    },
  });

  if (user) {
    // Link OAuth if this user signed up with email
    if (!user.oauthProvider) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { oauthProvider: provider, oauthProviderId: providerId },
      });
    }
  } else {
    // Generate unique username from email
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    let username = baseUsername;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        displayName: displayName || username,
        avatarUrl: avatarUrl || null,
        oauthProvider: provider,
        oauthProviderId: providerId,
      },
    });

    await createDefaultLibraries(user.id);
  }

  const tokens = generateTokens(user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

// ── Refresh Token ─────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokens = generateTokens(user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

// ── Logout ────────────────────────────────────────────

export async function logout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

// ── Error class ───────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
