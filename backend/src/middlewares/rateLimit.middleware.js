import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

function build(limit, message) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
        : Math.ceil(WINDOW_MS / 1000);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message,
          details: { retryAfterSeconds },
        },
      });
    },
  });
}

// 10 req / 15 min / IP
export const authLimiter = build(10, 'Too many authentication attempts, please try again later');
// 20 req / 15 min / IP
export const paymentLimiter = build(20, 'Too many payment requests, please try again later');
// 300 req / 15 min / IP
export const globalLimiter = build(300, 'Too many requests, please try again later');