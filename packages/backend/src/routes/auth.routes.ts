import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import { signup, login, refreshAccessToken, logout, oauthLogin, AppError } from '../services/auth.service';
import { config } from '../config';

const router = Router();

// ── Validation Schemas ──────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const oauthSchema = z.object({
  token: z.string().min(1, 'OAuth token is required'),
  provider: z.enum(['google', 'apple']),
});

// ── Cookie helpers ──────────────────────────────────

const REFRESH_COOKIE_NAME = 'gt_refresh_token';

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}

// ── POST /auth/signup ───────────────────────────────

router.post('/signup', validateBody(signupSchema), async (req: Request, res: Response) => {
  try {
    const result = await signup(req.body);
    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/login ────────────────────────────────

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await login(req.body);
    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/oauth ────────────────────────────────

router.post('/oauth', validateBody(oauthSchema), async (req: Request, res: Response) => {
  try {
    const { token, provider } = req.body;

    // Verify the OAuth token with the provider
    let email: string;
    let providerId: string;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    if (provider === 'google') {
      // Verify Google ID token
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!response.ok) {
        res.status(401).json({ success: false, error: 'Invalid Google token' });
        return;
      }
      const googleUser = (await response.json()) as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };
      email = googleUser.email;
      providerId = googleUser.sub;
      displayName = googleUser.name;
      avatarUrl = googleUser.picture;
    } else if (provider === 'apple') {
      // Apple Sign-In token verification (simplified — production should verify JWT properly)
      // For now, we'll decode the identity token's payload
      const parts = token.split('.');
      if (parts.length !== 3) {
        res.status(401).json({ success: false, error: 'Invalid Apple token' });
        return;
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as {
        sub: string;
        email: string;
      };
      email = payload.email;
      providerId = payload.sub;
    } else {
      res.status(400).json({ success: false, error: 'Unsupported OAuth provider' });
      return;
    }

    const result = await oauthLogin({
      email,
      provider,
      providerId,
      displayName,
      avatarUrl,
    });

    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('OAuth error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/refresh ──────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      res.status(401).json({ success: false, error: 'No refresh token' });
      return;
    }

    const result = await refreshAccessToken(refreshToken);
    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      clearRefreshCookie(res);
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/logout ───────────────────────────────

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await logout(userId);
    clearRefreshCookie(res);

    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /auth/me ────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const user = await (await import('../lib/prisma')).default.user.findUnique({
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
