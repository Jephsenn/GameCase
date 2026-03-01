import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import prisma from './lib/prisma';
import { getRedis } from './lib/redis';
import { runStartupSeed } from './jobs/startup-seed';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import libraryRoutes from './routes/library.routes';
import recommendationRoutes from './routes/recommendation.routes';
import friendRoutes from './routes/friend.routes';
import activityRoutes from './routes/activity.routes';

const app = express();

// ── Security ─────────────────────────────────
app.use(helmet());

// Support comma-separated origins (e.g. "https://app.vercel.app,http://localhost:3000")
const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  }),
);

// ── Compression ──────────────────────────────
app.use(compression());

// ── Rate limiting ────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ── Parsing ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request logging ──────────────────────────
app.use((req, _res, next) => {
  if (req.path !== '/health' && req.path !== '/health/ready') {
    logger.info({ method: req.method, url: req.url }, 'incoming request');
  }
  next();
});

// ── Health checks ────────────────────────────

/** Basic liveness probe — always returns ok if the process is running. */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Readiness probe — checks Postgres + Redis connectivity. */
app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = { postgres: 'error', redis: 'error' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch { /* noop */ }

  try {
    const redis = getRedis();
    if (redis.status === 'ready') {
      await redis.ping();
      checks.redis = 'ok';
    }
  } catch { /* noop */ }

  const healthy = checks.postgres === 'ok'; // Redis is optional
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ── API routes ───────────────────────────────
app.get('/api/v1', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'GameTracker API',
      version: '1.0.0',
      environment: config.nodeEnv,
    },
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/libraries', libraryRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);
app.use('/api/v1/friends', friendRoutes);
app.use('/api/v1/activity', activityRoutes);

// ── Admin: manual seed trigger ───────────────
app.post('/api/v1/admin/seed', async (_req, res) => {
  try {
    logger.info('Manual seed triggered via /api/v1/admin/seed');
    await runStartupSeed();
    const prismaModule = await import('./lib/prisma');
    const counts = {
      games: await prismaModule.default.game.count(),
      platforms: await prismaModule.default.platform.count(),
      genres: await prismaModule.default.genre.count(),
      tags: await prismaModule.default.tag.count(),
    };
    res.json({ success: true, message: 'Seed completed', data: counts });
  } catch (error) {
    logger.error({ err: error }, 'Manual seed failed');
    res.status(500).json({ success: false, error: 'Seed failed' });
  }
});

// ── 404 handler ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ── Error handler ────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: config.isProduction ? 'Internal server error' : err.message,
  });
});

export default app;
