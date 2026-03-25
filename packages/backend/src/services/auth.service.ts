import crypto from 'crypto';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { generateTokens, verifyRefreshToken } from '../lib/jwt';
import { DEFAULT_LIBRARIES } from '@gamecase/shared';
import { getRedis } from '../lib/redis';
import { logger } from '../lib/logger';

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
  email?: string; // Apple only includes email on first sign-in; may be absent on repeat logins
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
    plan: string;
    onboardingDone: boolean;
    steamId: string | null;
    steamPlayerName: string | null;
    steamAvatarUrl: string | null;
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
  plan: string;
  onboardingDone: boolean;
  steamId?: string | null;
  steamPlayerName?: string | null;
  steamAvatarUrl?: string | null;
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
    plan: user.plan,
    onboardingDone: user.onboardingDone,
    steamId: user.steamId ?? null,
    steamPlayerName: user.steamPlayerName ?? null,
    steamAvatarUrl: user.steamAvatarUrl ?? null,
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

  // Try to find existing OAuth user by providerId first, then fall back to email match.
  // Apple only includes email on the first sign-in, so we cannot always rely on it.
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { oauthProvider: provider, oauthProviderId: providerId },
        ...(email ? [{ email: email.toLowerCase() }] : []),
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
    // New user — email is required to create an account
    if (!email) {
      throw new AppError('Email permission is required on first sign-in with Apple', 400);
    }

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

// ── Forgot Password ───────────────────────────────────

const PWD_RESET_PREFIX = 'pwd_reset:';
const PWD_RESET_TTL_S = 3600; // 1 hour

/**
 * Generates a password reset token and stores it in Redis.
 * In production this would trigger an email. In development the token is
 * logged so it can be used directly for testing.
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, passwordHash: true },
  });

  // Always succeed to avoid leaking account existence
  if (!user || !user.passwordHash) return;

  const token = crypto.randomBytes(32).toString('hex');
  const redis = getRedis();
  await redis.setex(`${PWD_RESET_PREFIX}${token}`, PWD_RESET_TTL_S, user.id);

  // TODO: Replace with real email in production. For now, log the token.
  logger.info({ token, email: email.toLowerCase() }, '[forgot-password] Reset token generated — send this to the user via email');
}

/**
 * Validates a password reset token and updates the user's password.
 * Deletes the token after use so it cannot be reused.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const redis = getRedis();
  const userId = await redis.get(`${PWD_RESET_PREFIX}${token}`);

  if (!userId) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const hash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  await redis.del(`${PWD_RESET_PREFIX}${token}`);
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
