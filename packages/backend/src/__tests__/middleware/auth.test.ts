import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { generateTokens } from '../../lib/jwt';

/**
 * Helper — builds a minimal Express Request-like object.
 */
function mockReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as Partial<Request>;
}

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response['json'];
  return res as Response;
}

describe('requireAuth middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('rejects when no Authorization header is provided', () => {
    const req = mockReq() as Request;
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Authentication required' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when header does not start with Bearer', () => {
    const req = mockReq('Basic abc123') as Request;
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', () => {
    const req = mockReq('Bearer invalidtoken') as Request;
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or expired token' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes and attaches userId/userEmail for a valid token', () => {
    const { accessToken } = generateTokens('user-42', 'alice@example.com');
    const req = mockReq(`Bearer ${accessToken}`) as Request;
    const res = mockRes();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).userId).toBe('user-42');
    expect((req as any).userEmail).toBe('alice@example.com');
  });
});

describe('optionalAuth middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('proceeds without error when no header is present', () => {
    const req = mockReq() as Request;
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).userId).toBeUndefined();
  });

  it('attaches user info when a valid token is present', () => {
    const { accessToken } = generateTokens('user-99', 'bob@example.com');
    const req = mockReq(`Bearer ${accessToken}`) as Request;
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).userId).toBe('user-99');
    expect((req as any).userEmail).toBe('bob@example.com');
  });

  it('proceeds without error when token is invalid', () => {
    const req = mockReq('Bearer badtoken') as Request;
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).userId).toBeUndefined();
  });
});
