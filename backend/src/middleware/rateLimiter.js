
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

const memoryBuckets = new Map();

export function rateLimiter({
  windowMs = 60_000,
  max = 100,
  keyPrefix = 'rate-limit',
} = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new Error('windowMs must be a positive integer.');
  }

  if (!Number.isInteger(max) || max < 1) {
    throw new Error('max must be a positive integer.');
  }

  return async (req, res, next) => {
    // Use the authenticated identity when available, otherwise the IP.
    const identity = req.user?.id || req.ip || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const now = Date.now();

    res.set('X-RateLimit-Limit', String(max));

    try {
      if (env.redisEnabled && redis.isReady) {
        const redisKey = `${keyPrefix}:${identity}`;
        const count = await redis.incr(redisKey);

        if (count === 1) {
          await redis.pExpire(redisKey, windowMs);
        }

        const ttl = await redis.pTTL(redisKey);
        const remainingMs = ttl > 0 ? ttl : windowMs;

        res.set('X-RateLimit-Remaining', String(Math.max(0, max - count)));
        res.set(
          'X-RateLimit-Reset',
          String(Math.ceil((now + remainingMs) / 1000))
        );

        if (count > max) {
          res.set('Retry-After', String(Math.max(1, Math.ceil(remainingMs / 1000))));

          return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
          });
        }

        return next();
      }

      if (env.isProduction) {
        // Do not silently bypass rate limiting in production.
        return res.status(503).json({
          success: false,
          message: 'Rate limiting service is temporarily unavailable.',
        });
      }

      // Development-only in-memory fallback.
      let bucket = memoryBuckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        memoryBuckets.set(key, bucket);
      }

      bucket.count += 1;

      res.set('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
      res.set(
        'X-RateLimit-Reset',
        String(Math.ceil(bucket.resetAt / 1000))
      );

      if (bucket.count > max) {
        res.set(
          'Retry-After',
          String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
        );

        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }

      return next();
    } catch (error) {
      console.error('Rate limiter error:', error.message);

      if (env.isProduction) {
        return res.status(503).json({
          success: false,
          message: 'Rate limiting service is temporarily unavailable.',
        });
      }

      return next();
    }
  };
}

export const apiRateLimiter = rateLimiter({
  windowMs: 60_000,
  max: 120,
  keyPrefix: 'etdox:api',
});

export const loginRateLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  keyPrefix: 'etdox:login',
});

export default rateLimiter;
