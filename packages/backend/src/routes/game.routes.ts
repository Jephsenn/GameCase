import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import {
  searchGames,
  getGameDetail,
  discoverGames,
  getPlatforms,
  getGenres,
  importGamesFromRawg,
  ingestFullGame,
} from '../services/game.service';
import { cacheInvalidatePattern } from '../lib/redis';
import { PAGINATION, SEARCH } from '@gamecase/shared';

const router = Router();

// ── GET /api/v1/games — Search local game database ──────

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE);
    const pageSize = Math.min(
      parseInt(req.query.pageSize as string) || PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    );
    const query = (req.query.q as string) || undefined;
    const genres = req.query.genres ? (req.query.genres as string).split(',') : undefined;
    const platforms = req.query.platforms ? (req.query.platforms as string).split(',') : undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const sortBy = req.query.sortBy as 'title' | 'rating' | 'releaseDate' | 'metacritic' | 'popularity' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    const result = await searchGames({
      query,
      genres,
      platforms,
      tags,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Game search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search games' });
  }
});

// ── GET /api/v1/games/discover — Search RAWG directly ───

router.get('/discover', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < SEARCH.MIN_QUERY_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Search query must be at least ${SEARCH.MIN_QUERY_LENGTH} characters`,
      });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 40);

    const result = await discoverGames(query, page, pageSize);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Game discover error:', error);
    res.status(500).json({ success: false, error: 'Failed to discover games' });
  }
});

// ── GET /api/v1/games/platforms — List all platforms ─────

router.get('/platforms', async (_req: Request, res: Response) => {
  try {
    const platforms = await getPlatforms();
    res.json({ success: true, data: platforms });
  } catch (error) {
    console.error('Platforms error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch platforms' });
  }
});

// ── GET /api/v1/games/genres — List all genres ──────────

router.get('/genres', async (_req: Request, res: Response) => {
  try {
    const genres = await getGenres();
    res.json({ success: true, data: genres });
  } catch (error) {
    console.error('Genres error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch genres' });
  }
});

// ── GET /api/v1/games/:idOrSlug — Get game detail ──────

router.get('/:idOrSlug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const detail = await getGameDetail(req.params.idOrSlug, true);

    if (!detail) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Game detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch game details' });
  }
});

// ── POST /api/v1/games/import — Admin: bulk import from RAWG ──

const importSchema = z.object({
  ordering: z.string().optional(),
  dates: z.string().optional(),
  genres: z.string().optional(),
  platforms: z.string().optional(),
  pages: z.number().int().min(1).max(25).optional().default(5),
});

router.post('/import', validateBody(importSchema), async (req: Request, res: Response) => {
  try {
    // TODO: add admin-only auth guard in a later phase
    const { ordering, dates, genres, platforms, pages } = req.body;
    const result = await importGamesFromRawg({ ordering, dates, genres, platforms }, pages);

    res.json({
      success: true,
      data: result,
      message: `Imported ${result.imported} games (${result.failed} failed)`,
    });
  } catch (error) {
    console.error('Game import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import games' });
  }
});

// ── POST /api/v1/games/ingest/:rawgId — Ingest one game from RAWG ──

router.post('/ingest/:rawgId', async (req: Request, res: Response) => {
  try {
    const rawgId = parseInt(req.params.rawgId);
    if (isNaN(rawgId)) {
      res.status(400).json({ success: false, error: 'Invalid RAWG ID' });
      return;
    }

    const gameId = await ingestFullGame(rawgId);
    const detail = await getGameDetail(gameId);

    res.json({ success: true, data: detail, message: 'Game ingested successfully' });
  } catch (error) {
    console.error('Game ingest error:', error);
    res.status(500).json({ success: false, error: 'Failed to ingest game' });
  }
});

// ── POST /api/v1/games/flush-cache — Admin: clear game search caches ──

router.post('/flush-cache', async (_req: Request, res: Response) => {
  try {
    await cacheInvalidatePattern('games:*');
    res.json({ success: true, message: 'Game caches flushed' });
  } catch (error) {
    console.error('Cache flush error:', error);
    res.status(500).json({ success: false, error: 'Failed to flush cache' });
  }
});

export default router;
