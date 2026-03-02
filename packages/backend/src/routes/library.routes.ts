import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  getUserLibraries,
  getLibraryBySlug,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  addGameToLibrary,
  updateLibraryItem,
  removeFromLibrary,
  moveGameToLibrary,
  getGameLibraryStatus,
  LibraryError,
  type LibraryQueryOptions,
} from '../services/library.service';
import { PAGINATION } from '@gametracker/shared';

const router = Router();

// All library routes require authentication
router.use(requireAuth);

// Helper to handle LibraryError
function handleError(res: Response, error: unknown) {
  if (error instanceof LibraryError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error('Library error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// Helper to parse library query options from request
function parseLibraryQuery(query: Record<string, unknown>): LibraryQueryOptions {
  const opts: LibraryQueryOptions = {
    page: Math.max(1, parseInt(query.page as string) || PAGINATION.DEFAULT_PAGE),
    pageSize: Math.min(
      parseInt(query.pageSize as string) || PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    ),
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
  return opts;
}

// ── GET /api/v1/libraries — List user's libraries ───────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const libraries = await getUserLibraries(userId);
    res.json({ success: true, data: libraries });
  } catch (error) {
    handleError(res, error);
  }
});

// ── POST /api/v1/libraries — Create a custom library ────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

router.post('/', validateBody(createSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const library = await createLibrary(userId, req.body);
    res.status(201).json({ success: true, data: library });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /api/v1/libraries/:slug — Get library with items ─

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const opts = parseLibraryQuery(req.query as Record<string, unknown>);
    const result = await getLibraryBySlug(userId, req.params.slug, opts);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

// ── PATCH /api/v1/libraries/:id — Update library ────────

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

router.patch('/:id', validateBody(updateSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const library = await updateLibrary(userId, req.params.id, req.body);
    res.json({ success: true, data: library });
  } catch (error) {
    handleError(res, error);
  }
});

// ── DELETE /api/v1/libraries/:id — Delete custom library ─

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await deleteLibrary(userId, req.params.id);
    res.json({ success: true, data: { message: 'Library deleted' } });
  } catch (error) {
    handleError(res, error);
  }
});

// ── POST /api/v1/libraries/:id/items — Add game to library ─

const addItemSchema = z.object({
  gameId: z.string().min(1),
  notes: z.string().max(2000).optional(),
  userRating: z.number().min(0).max(5).optional(),
  platformsPlayed: z.array(z.string().min(1).max(50)).max(20).optional(),
});

router.post('/:id/items', validateBody(addItemSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const item = await addGameToLibrary(userId, req.params.id, req.body.gameId, {
      notes: req.body.notes,
      userRating: req.body.userRating,
      platformsPlayed: req.body.platformsPlayed,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

// ── PATCH /api/v1/libraries/items/:itemId — Update item ─

const updateItemSchema = z.object({
  notes: z.string().max(2000).optional(),
  userRating: z.number().min(0).max(5).nullable().optional(),
  platformsPlayed: z.array(z.string().min(1).max(50)).max(20).optional(),
});

router.patch('/items/:itemId', validateBody(updateItemSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const item = await updateLibraryItem(userId, req.params.itemId, req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

// ── DELETE /api/v1/libraries/items/:itemId — Remove item ─

router.delete('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await removeFromLibrary(userId, req.params.itemId);
    res.json({ success: true, data: { message: 'Game removed from library' } });
  } catch (error) {
    handleError(res, error);
  }
});

// ── POST /api/v1/libraries/items/:itemId/move — Move item ─

const moveSchema = z.object({
  targetLibraryId: z.string().min(1),
});

router.post('/items/:itemId/move', validateBody(moveSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await moveGameToLibrary(userId, req.params.itemId, req.body.targetLibraryId);
    res.json({ success: true, data: { message: 'Game moved successfully' } });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /api/v1/libraries/game-status/:gameId — Check which libraries have a game ─

router.get('/game-status/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const status = await getGameLibraryStatus(userId, req.params.gameId);
    res.json({ success: true, data: status });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
