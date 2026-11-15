import { AppError } from '../utils/response.util.js';
import { verifyAccessToken } from '../utils/jwt.util.js';
import prisma from '../config/database.js';
import { getCachedJson, setCachedJson } from '../services/cache/redis-cache.js';

function readBearerToken(req) {
  const value = req.headers.authorization;
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

async function getCurrentUserState(userId) {
  const cacheKey = `auth:user:${userId}`;
  const cached = await getCachedJson(cacheKey);
  if (cached) return cached;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, jobRole: true, isActive: true, tokenVersion: true },
  });
  if (!user) return null;
  const state = { id: user.id, role: user.role, jobRole: user.jobRole ?? null, isActive: user.isActive, tokenVersion: user.tokenVersion ?? 0 };
  await setCachedJson(cacheKey, state, 10);
  return state;
}

async function attachUser(req, token) {
  let decoded;
  try { decoded = verifyAccessToken(token); }
  catch (error) {
    if (error.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
  }
  if (typeof decoded.sub !== 'string' || !decoded.sub) throw new AppError(401, 'UNAUTHORIZED', 'Invalid token subject');
  const current = await getCurrentUserState(decoded.sub);
  if (!current || current.isActive === false) throw new AppError(401, 'ACCOUNT_DISABLED', 'حساب کاربری غیرفعال است');
  if (Number(decoded.tokenVersion ?? 0) !== Number(current.tokenVersion ?? 0)) throw new AppError(401, 'TOKEN_REVOKED', 'نشست نیازمند ورود مجدد است');
  req.user = { id: current.id, role: current.role, jobRole: current.jobRole };
}

export async function authenticate(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'No bearer token provided'));
  try { await attachUser(req, token); return next(); }
  catch (error) { return next(error); }
}

export async function optionalAuthenticate(req, res, next) {
  const token = readBearerToken(req);
  if (!token) { req.user = null; return next(); }
  try { await attachUser(req, token); return next(); }
  catch (error) { return next(error); }
}
