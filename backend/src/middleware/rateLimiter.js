import rateLimit from "express-rate-limit";

const standardHeaders = "draft-8";

function rateLimitHandler(_req, res) {
  return res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  });
}

/**
 * General API limiter.
 * Maximum 200 requests per 15-minute window per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Authentication limiter.
 * Maximum 10 requests per 15-minute window per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true,
});

export default apiRateLimiter;