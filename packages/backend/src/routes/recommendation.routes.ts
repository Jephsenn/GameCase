import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  getRecommendations,
  resetAndRefreshRecommendations,
  generateMoreRecommendations,
  getRecommendationStatus,
  dismissRecommendation,
  RecommendationError,
} from '../services/recommendation.service';

const router = Router();

// All recommendation routes require authentication
router.use(requireAuth);

// ── GET / — Paginated recommendations ─────────

const getRecsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = getRecsSchema.parse(req.query);
    const userId = (req as AuthenticatedRequest).userId;
    const data = await getRecommendations(userId, page, pageSize);
    res.json({ success: true, data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid query parameters', details: err.flatten().fieldErrors });
      return;
    }
    console.error('GET /recommendations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

// ── GET /status — Current recommendation status ─

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const status = await getRecommendationStatus(userId);
    res.json({ success: true, data: status });
  } catch (err) {
    console.error('GET /recommendations/status error:', err);
    res.status(500).json({ success: false, error: 'Failed to get recommendation status' });
  }
});

// ── POST /refresh — Full reset (clears dismissals) ─

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const count = await resetAndRefreshRecommendations(userId);
    res.json({ success: true, data: { count, message: `Generated ${count} recommendations` } });
  } catch (err) {
    console.error('POST /recommendations/refresh error:', err);
    res.status(500).json({ success: false, error: 'Failed to refresh recommendations' });
  }
});

// ── POST /generate — Generate more (preserves dismissals) ─

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const count = await generateMoreRecommendations(userId);
    res.json({ success: true, data: { count, message: `Generated ${count} recommendations` } });
  } catch (err) {
    console.error('POST /recommendations/generate error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

// ── DELETE /:id — Dismiss a recommendation ────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    await dismissRecommendation(userId, req.params.id);
    res.json({ success: true, data: { message: 'Recommendation dismissed' } });
  } catch (err) {
    if (err instanceof RecommendationError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    console.error('DELETE /recommendations/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to dismiss recommendation' });
  }
});

export default router;
