import Redis from 'ioredis';
import { config } from '../config';
import { createLogger } from './logger';

const log = createLogger('redis');

// ── Redis client singleton ──────────────────────────────

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      log.error({ err }, 'Redis connection error');
    });

    redis.on('connect', () => {
      log.info('Redis connected');
    });
  }

  return redis;
}

// ── Cache helpers ───────────────────────────────────────

/**
 * Get a cached value, parsed as JSON.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with TTL (seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // cache write failure is non-fatal
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
  } catch {
    // cache delete failure is non-fatal
  }
}

/**
 * Delete all keys matching a glob pattern (e.g. "games:search:*").
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await r.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // non-fatal
  }
}

/**
 * Gracefully disconnect Redis.
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
