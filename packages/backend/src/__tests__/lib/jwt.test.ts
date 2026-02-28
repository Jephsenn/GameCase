import { describe, it, expect } from 'vitest';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '../../lib/jwt';

describe('JWT utilities', () => {
  const userId = 'user-123';
  const email = 'test@example.com';

  it('generates an access and refresh token pair', () => {
    const tokens = generateTokens(userId, email);
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });

  it('verifyAccessToken returns the correct payload', () => {
    const { accessToken } = generateTokens(userId, email);
    const payload = verifyAccessToken(accessToken);
    expect(payload.userId).toBe(userId);
    expect(payload.email).toBe(email);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('verifyRefreshToken returns the correct payload', () => {
    const { refreshToken } = generateTokens(userId, email);
    const payload = verifyRefreshToken(refreshToken);
    expect(payload.userId).toBe(userId);
    expect(payload.email).toBe(email);
  });

  it('verifyAccessToken throws for a refresh token', () => {
    const { refreshToken } = generateTokens(userId, email);
    // The secrets differ, so this should throw
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  it('verifyRefreshToken throws for an access token', () => {
    const { accessToken } = generateTokens(userId, email);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('verifyAccessToken throws for a garbage token', () => {
    expect(() => verifyAccessToken('not.a.real.token')).toThrow();
  });
});
