import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

/**
 * Express request augmented with authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
}

/**
 * Middleware: requires a valid JWT access token in the Authorization header.
 * Attaches userId and userEmail to the request.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.userId;
    (req as AuthenticatedRequest).userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: optionally extracts user info if a valid token is present,
 * but does not block unauthenticated requests.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      (req as AuthenticatedRequest).userId = payload.userId;
      (req as AuthenticatedRequest).userEmail = payload.email;
    } catch {
      // Token invalid — proceed without auth
    }
  }

  next();
}
