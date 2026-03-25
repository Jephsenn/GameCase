import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import { signup, login, refreshAccessToken, logout, oauthLogin, forgotPassword, resetPassword, AppError } from '../services/auth.service';
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
        refreshToken: result.refreshToken,
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
        refreshToken: result.refreshToken,
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
    let email: string | undefined;
    let providerId: string;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    if (provider === 'google') {
      // Try verifying as an ID token first, then fall back to access token (userinfo endpoint)
      let googleUser: { sub: string; email: string; name?: string; picture?: string } | null = null;

      // Attempt 1: ID token verification (web clients)
      const idTokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (idTokenResponse.ok) {
        googleUser = (await idTokenResponse.json()) as { sub: string; email: string; name?: string; picture?: string };
      } else {
        // Attempt 2: Access token → userinfo endpoint (mobile clients)
        const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userinfoResponse.ok) {
          const info = (await userinfoResponse.json()) as { sub: string; email: string; name?: string; picture?: string };
          googleUser = info;
        }
      }

      if (!googleUser) {
        res.status(401).json({ success: false, error: 'Invalid Google token' });
        return;
      }

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
        email?: string; // only present on first sign-in
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
        refreshToken: result.refreshToken,
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

// ── POST /auth/google/code-exchange ──────────────────
// Mobile clients send the authorization code here; backend exchanges it
// with Google using the client_secret and returns app JWT tokens.

const codeExchangeSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  codeVerifier: z.string().optional().default(''),
  redirectUri: z.string().min(1, 'Redirect URI is required'),
});

router.post('/google/code-exchange', validateBody(codeExchangeSchema), async (req: Request, res: Response) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;

    // Exchange the authorization code for tokens with Google
    const tokenParams: Record<string, string> = {
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Google token exchange failed:', err);
      res.status(401).json({ success: false, error: 'Failed to exchange Google authorization code' });
      return;
    }

    const googleTokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
    };

    // Get user info from Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleTokens.access_token}` },
    });

    if (!userinfoResponse.ok) {
      res.status(401).json({ success: false, error: 'Failed to fetch Google user info' });
      return;
    }

    const googleUser = (await userinfoResponse.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    const result = await oauthLogin({
      email: googleUser.email,
      provider: 'google',
      providerId: googleUser.sub,
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
    });

    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Google code exchange error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/refresh ──────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Accept refresh token from request body (mobile) or HTTP-only cookie (web)
    const refreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];

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
        refreshToken: result.refreshToken,
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

// ── POST /auth/forgot-password ──────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    await forgotPassword(req.body.email);
    // Always return success so attackers can't enumerate accounts
    res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent.' } });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /auth/reset-password ───────────────────────

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

router.post('/reset-password', validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    await resetPassword(req.body.token, req.body.password);
    res.json({ success: true, data: { message: 'Password reset successfully.' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
