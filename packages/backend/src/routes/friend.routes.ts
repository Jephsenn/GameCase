import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  blockUser,
  getFriends,
  getPendingRequests,
  getSentRequests,
  getFriendshipStatus,
  FriendError,
} from '../services/friend.service';

const router = Router();

// All friend routes require authentication
router.use(requireAuth);

function handleError(res: Response, error: unknown) {
  if (error instanceof FriendError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error('Friend error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── POST /friends/request — Send friend request ─────

const requestSchema = z.object({
  username: z.string().min(1),
});

router.post('/request', validateBody(requestSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await sendFriendRequest(userId, req.body.username);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

// ── PATCH /friends/:friendshipId/respond — Accept/Decline ─

const respondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

router.patch('/:friendshipId/respond', validateBody(respondSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await respondToRequest(userId, req.params.friendshipId, req.body.action);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

// ── DELETE /friends/:friendshipId — Remove friend ───

router.delete('/:friendshipId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await removeFriend(userId, req.params.friendshipId);
    res.json({ success: true, data: { message: 'Friend removed' } });
  } catch (error) {
    handleError(res, error);
  }
});

// ── POST /friends/block — Block user ────────────────

const blockSchema = z.object({
  targetUserId: z.string().min(1),
});

router.post('/block', validateBody(blockSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await blockUser(userId, req.body.targetUserId);
    res.json({ success: true, data: { message: 'User blocked' } });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /friends — Get accepted friends list ────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const friends = await getFriends(userId);
    res.json({ success: true, data: friends });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /friends/pending — Incoming pending requests ─

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const requests = await getPendingRequests(userId);
    res.json({ success: true, data: requests });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /friends/sent — Sent pending requests ───────

router.get('/sent', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const requests = await getSentRequests(userId);
    res.json({ success: true, data: requests });
  } catch (error) {
    handleError(res, error);
  }
});

// ── GET /friends/status/:targetUserId — Friendship status ─

router.get('/status/:targetUserId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const status = await getFriendshipStatus(userId, req.params.targetUserId);
    res.json({ success: true, data: status });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
