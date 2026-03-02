import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  getProfile,
  getPublicProfile,
  updateProfile,
  completeOnboarding,
  getAllGenres,
} from '../services/user.service';
import { getPublicLibraryBySlug, LibraryError, type LibraryQueryOptions } from '../services/library.service';
import { getUserStats } from '../services/stats.service';
import { AppError } from '../services/auth.service';

const router = Router();
// ── Multer (avatar uploads) ─────────────────────

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(__dirname, '../../uploads/avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const { userId } = req as AuthenticatedRequest;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${userId}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  },
});
// ── Validation Schemas ──────────────────────────────

const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

const onboardingSchema = z.object({
  genreIds: z.array(z.string()).min(1, 'Select at least one genre'),
});

// ── GET /users/stats ────────────────────────────────

router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    // Pro plan check
    const prisma = (await import('../lib/prisma')).default;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (user?.plan !== 'pro') {
      res.status(403).json({
        success: false,
        error: 'Upgrade to Pro to unlock Year in Review stats',
      });
      return;
    }

    const stats = await getUserStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /users/profile ──────────────────────────────

router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const profile = await getProfile(userId);
    res.json({ success: true, data: { user: profile } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── PATCH /users/profile ────────────────────────────

router.patch(
  '/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const user = await updateProfile(userId, req.body);
      res.json({ success: true, data: { user } });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },
);

// ── POST /users/profile/avatar ──────────────────────

router.post(
  '/profile/avatar',
  requireAuth,
  uploadAvatar.single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file provided' });
        return;
      }
      const { userId } = req as AuthenticatedRequest;
      // Build URL from the configured API base so it is always reachable by clients.
      // Strip any trailing /api/v1 suffix to get the server root.
      const { config } = await import('../config');
      const serverRoot = (process.env.BACKEND_PUBLIC_URL || `http://localhost:${config.port}`).replace(/\/$/, '');
      // Append timestamp so browsers don't serve a cached version of a replaced image
      const avatarUrl = `${serverRoot}/uploads/avatars/${req.file.filename}?v=${Date.now()}`;
      const user = await updateProfile(userId, { avatarUrl });
      res.json({ success: true, data: { user, avatarUrl } });
    } catch (error) {
      if ((error as { message?: string }).message?.includes('Only JPEG')) {
        res.status(400).json({ success: false, error: (error as Error).message });
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      console.error('Upload avatar error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },
);

// ── GET /users/:username ────────────────────────────

router.get('/:username', async (req: Request, res: Response) => {
  try {
    const profile = await getPublicProfile(req.params.username);
    res.json({ success: true, data: { user: profile } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get public profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /users/:username/libraries — Public libraries ─

router.get('/:username/libraries', async (req: Request, res: Response) => {
  try {
    const profile = await getPublicProfile(req.params.username);
    res.json({ success: true, data: profile.libraries });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get public libraries error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /users/:username/libraries/:slug — Public library detail ─

router.get('/:username/libraries/:slug', async (req: Request, res: Response) => {
  try {
    const { username, slug } = req.params;
    const query = req.query as Record<string, unknown>;
    const opts: LibraryQueryOptions = {
      page: Math.max(1, parseInt(query.page as string) || 1),
      pageSize: Math.min(parseInt(query.pageSize as string) || 20, 100),
    };
    if (query.search && typeof query.search === 'string') opts.search = query.search.trim();
    if (query.sortBy && ['added', 'title', 'rating', 'release'].includes(query.sortBy as string)) {
      opts.sortBy = query.sortBy as LibraryQueryOptions['sortBy'];
    }
    if (query.sortOrder && ['asc', 'desc'].includes(query.sortOrder as string)) {
      opts.sortOrder = query.sortOrder as 'asc' | 'desc';
    }
    if (query.genres && typeof query.genres === 'string') {
      opts.genres = query.genres.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (query.platforms && typeof query.platforms === 'string') {
      opts.platforms = query.platforms.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (query.ratingFilter && ['rated', 'unrated'].includes(query.ratingFilter as string)) {
      opts.ratingFilter = query.ratingFilter as 'rated' | 'unrated';
    }
    const result = await getPublicLibraryBySlug(username, slug, opts);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof LibraryError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get public library detail error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /users/onboarding/genres ────────────────────

router.get('/onboarding/genres', async (_req: Request, res: Response) => {
  try {
    const genres = await getAllGenres();
    res.json({ success: true, data: { genres } });
  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /users/onboarding/complete ─────────────────

router.post(
  '/onboarding/complete',
  requireAuth,
  validateBody(onboardingSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await completeOnboarding(userId, req.body.genreIds);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      console.error('Complete onboarding error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },
);

export default router;
