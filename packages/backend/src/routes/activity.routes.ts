import { Router, Request, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getMyFeed, getUserActivity, ActivityError } from '../services/activity.service';
import { PAGINATION } from '@gametracker/shared';

const router = Router();

router.use(requireAuth);

function handleError(res: Response, error: unknown) {
  if (error instanceof ActivityError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error('Activity error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── GET /activity/feed — My social feed ─────────────

router.get('/feed', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const page = Math.max(1, parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE);
    const pageSize = Math.min(
      parseInt(req.query.pageSize as string) || PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    );
    const feed = await getMyFeed(userId, page, pageSize);
    res.json({ success: true, data: feed });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /activity/users/:userId — User's activity ───

router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const page = Math.max(1, parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE);
    const pageSize = Math.min(
      parseInt(req.query.pageSize as string) || PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    );
    const activity = await getUserActivity(userId, req.params.userId, page, pageSize);
    res.json({ success: true, data: activity });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
