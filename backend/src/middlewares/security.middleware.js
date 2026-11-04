import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import xss from 'xss';
import { env } from '../config/env.js';
import { COOKIE, CSRF_HEADER } from '../config/constants.js';
import { AppError } from '../utils/response.util.js';
import { randomToken } from '../utils/hash.util.js';

// Passwords must never be altered by the HTML sanitizer.
const SKIP_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'confirmPassword']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeValue(value, key) {
  if (typeof value === 'string') return SKIP_KEYS.has(key) ? value : xss(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      out[k] = sanitizeValue(v, k);
    }
    return out;
  }
  return value;
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

export function applySecurity(app) {
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 600,
    })
  );

  app.use(
    express.json({
      limit: '1mb',
      // keep the raw bytes: needed for HMAC verification of the payment webhook
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(sanitizeInput);
}

// Double-submit cookie: sets gh_csrf (readable by JS) and returns the token.
export function issueCsrfToken(req, res) {
  const token = randomToken(32);
  res.cookie(COOKIE.CSRF, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfProtect(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE.CSRF];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return next(new AppError(403, 'CSRF_INVALID', 'Invalid CSRF token'));
  }
  const a = Buffer.from(String(cookieToken));
  const b = Buffer.from(String(headerToken));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError(403, 'CSRF_INVALID', 'Invalid CSRF token'));
  }
  return next();
}