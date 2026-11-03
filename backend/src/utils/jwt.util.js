import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AUTH } from '../config/constants.js';
import { AppError } from './response.util.js';

export function signAccessToken({ sub, role }) {
  return jwt.sign({ sub, role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: AUTH.ACCESS_TTL,
  });
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (!payload || typeof payload !== 'object' || !payload.sub) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err?.name === 'TokenExpiredError') {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
  }
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + AUTH.REFRESH_DAYS * 24 * 60 * 60 * 1000);
  return { token, tokenHash: hashToken(token), expiresAt };
}