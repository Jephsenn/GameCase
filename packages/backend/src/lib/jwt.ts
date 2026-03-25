import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { TokenPayload } from '@gamecase/shared';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate an access + refresh token pair for a user.
 */
export function generateTokens(userId: string, email: string): TokenPair {
  const accessOpts: SignOptions = {
    expiresIn: config.jwtExpiresIn as string & SignOptions['expiresIn'],
  };
  const refreshOpts: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as string & SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign({ userId, email }, config.jwtSecret, accessOpts);
  const refreshToken = jwt.sign({ userId, email }, config.jwtRefreshSecret, refreshOpts);

  return { accessToken, refreshToken };
}

/**
 * Verify an access token and return its payload.
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

/**
 * Verify a refresh token and return its payload.
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
}
