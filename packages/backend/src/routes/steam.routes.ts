import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  importSteamLibrary,
  validateSteamId,
  resolveSteamInput,
  getLinkedSteamAccount,
  unlinkSteamAccount,
  getSteamImportedGames,
  unsyncSteamGame,
  unsyncAllSteamGames,
  removeAllSteamGames,
} from '../services/steam.service';
import { AppError } from '../services/auth.service';
import prisma from '../lib/prisma';

const router = Router();

// ── Validation Schemas ──────────────────────────

const importSchema = z.object({
  steamId: z.string().min(1, 'Steam ID is required'),
});

// ── GET /steam/account — Get linked Steam account ──

router.get('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const account = await getLinkedSteamAccount(userId);
    res.json({ success: true, data: account });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get steam account error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE /steam/account — Unlink Steam account ──

router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await unlinkSteamAccount(userId);
    res.json({ success: true, data: { message: 'Steam account unlinked' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Unlink steam error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /steam/games — Get all Steam-imported games ──

router.get('/games', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const games = await getSteamImportedGames(userId);
    res.json({ success: true, data: games });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Get steam games error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE /steam/games — Unsync all Steam games (remove tag only) ──

router.delete('/games', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await unsyncAllSteamGames(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Unsync all steam games error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE /steam/games/remove-all — Remove all Steam games from library ──

router.delete('/games/remove-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await removeAllSteamGames(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Remove all steam games error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE /steam/games/:itemId — Unsync single Steam game ──

router.delete('/games/:itemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await unsyncSteamGame(userId, req.params.itemId);
    res.json({ success: true, data: { message: 'Steam sync removed from game' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Unsync steam game error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /steam/import — Import Steam library (Pro only) ──

router.post('/import', requireAuth, validateBody(importSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    // Pro plan check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (user?.plan !== 'pro') {
      res.status(403).json({
        success: false,
        error: 'Upgrade to Pro to unlock Steam library import',
      });
      return;
    }

    const { steamId } = req.body;
    const resolvedId = await resolveSteamInput(steamId);
    const summary = await importSteamLibrary(userId, resolvedId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Steam import error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const validateSchema = z.object({
  steamId: z.string().min(1, 'Steam ID or URL is required'),
});

// ── POST /steam/validate — Validate Steam ID ──

router.post('/validate', requireAuth, validateBody(validateSchema), async (req: Request, res: Response) => {
  try {
    const { steamId } = req.body;
    const resolvedId = await resolveSteamInput(steamId);
    const result = await validateSteamId(resolvedId);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('Steam validate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
