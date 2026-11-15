import rateLimit from 'express-rate-limit';
import { HybridRateLimitStore } from './rate-limit.store.js';
import { incrementRateLimitCounter, decrementRateLimitCounter, resetRateLimitCounter } from '../services/cache/redis-cache.js';

function jsonLimiter({ name, windowMs, max, message }) {
  const store = new HybridRateLimitStore(name, {
    increment: incrementRateLimitCounter,
    decrement: decrementRateLimitCounter,
    reset: resetRateLimitCounter,
  });
  return rateLimit({
    store,
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message },
  });
}

const globalLimiter = jsonLimiter({
  name: 'global',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: 'Too many requests, please try again later',
});

const authLimiter = jsonLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
});

const ocrLimiter = jsonLimiter({
  name: 'ocr',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'تعداد درخواست‌های تشخیص تصویر بیش از حد مجاز است',
});

const searchLimiter = jsonLimiter({
  name: 'search',
  windowMs: 60 * 1000,
  max: 90,
  message: 'تعداد جستجوها بیش از حد مجاز است',
});

const paymentLimiter = jsonLimiter({
  name: 'payment',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many payment requests, please try again later',
});

export { globalLimiter, authLimiter, paymentLimiter, searchLimiter, ocrLimiter };
