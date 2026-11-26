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

// Credential attempts (login/register/password change).
//
// Mobile subscribers share carrier NAT addresses, so a per-IP budget of 10 per
// 15 minutes locked out users who had only opened the app a few times.
// Brute force is still bounded per account by AUTH.MAX_FAILED (account lock),
// and this limit keeps its role of stopping bulk abuse.
const authLimiter = jsonLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 credential requests per windowMs
  message: 'تعداد تلاش‌های ورود بیش از حد مجاز است؛ چند دقیقه بعد دوباره امتحان کنید',
});

// Session rotation (refresh/logout). Every app start refreshes the session, so
// this traffic must not consume the credential budget above.
const sessionLimiter = jsonLimiter({
  name: 'session',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  message: 'تعداد درخواست‌های نشست بیش از حد مجاز است؛ چند دقیقه بعد دوباره تلاش کنید',
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

export { globalLimiter, authLimiter, sessionLimiter, paymentLimiter, searchLimiter, ocrLimiter };
