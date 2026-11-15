import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { env } from '../config/env.js';

const CSRF_COOKIE = 'gh_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.APP_BASE_URL || '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function applySecurity(app) {
  app.use(helmet());

  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      // Reflecting every origin while sending credentials is unsafe. Require an
      // explicit allowlist in production; fall back to reflect-all only in dev.
      origin:
        allowedOrigins.length > 0
          ? allowedOrigins
          : process.env.NODE_ENV === 'production'
            ? false
            : true,
      credentials: true,
    })
  );

  app.use(hpp());
  app.use(cookieParser());
}

// Double-submit CSRF: issue a random token in a JS-readable cookie. The SPA
// echoes it back in the X-CSRF-Token header, and csrfProtect compares the two.
// This replaces the previous req.csrfToken() call, which required `csurf` to be
// installed and would otherwise throw.
export function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by the SPA to echo in the header
    secure: process.env.NODE_ENV === 'production',
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  });

  return res.status(200).json({ success: true, data: { csrfToken: token }, meta: { requestId: req.requestId } });
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Invalid CSRF token',
      error: { code: 'FORBIDDEN', message: 'Invalid CSRF token', requestId: req.requestId },
    });
  }

  return next();
}
