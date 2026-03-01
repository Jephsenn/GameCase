import { Router, Request, Response } from 'express';
import { z } from 'zod';
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
import { AppError } from '../services/auth.service';

const router = Router();

// ── Validation Schemas ──────────────────────────────

const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

const onboardingSchema = z.object({
  genreIds: z.array(z.string()).min(1, 'Select at least one genre'),
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
