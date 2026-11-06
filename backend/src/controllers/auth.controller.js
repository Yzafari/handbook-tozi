import asyncHandler from '../utils/asyncHandler.util.js';
import { ok, created, AppError } from '../utils/response.util.js';
import { env } from '../config/env.js';
import { COOKIE, AUTH } from '../config/constants.js';
import { randomToken } from '../utils/hash.util.js';
import * as authService from '../services/auth.service.js';

const isSecure = () => env.COOKIE_SECURE === true || env.COOKIE_SECURE === 'true';

const refreshCookieOptions = (expires) => ({
  httpOnly: true,
  secure: isSecure(),
  sameSite: 'strict',
  path: '/api/auth',
  expires,
});

const csrfCookieOptions = (expires) => ({
  httpOnly: false,
  secure: isSecure(),
  sameSite: 'strict',
  path: '/',
  ...(expires ? { expires } : {}),
});

function setAuthCookies(res, refreshToken, refreshExpiresAt) {
  const csrfToken = randomToken(32);
  res.cookie(COOKIE.REFRESH, refreshToken, refreshCookieOptions(refreshExpiresAt));
  res.cookie(COOKIE.CSRF, csrfToken, csrfCookieOptions(refreshExpiresAt));
  return csrfToken;
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE.REFRESH, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'strict',
    path: '/api/auth',
  });
  res.clearCookie(COOKIE.CSRF, {
    httpOnly: false,
    secure: isSecure(),
    sameSite: 'strict',
    path: '/',
  });
}

const noStore = (res) => res.set('Cache-Control', 'no-store');

function readRefreshCookie(req) {
  const token = req.cookies?.[COOKIE.REFRESH];
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'UNAUTHORIZED', 'نشست یافت نشد. لطفاً وارد شوید.');
  }
  return token;
}

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body, req);
  return created(res, { user }, 'ثبت‌نام با موفقیت انجام شد');
});

export const login = asyncHandler(async (req, res) => {
  const { accessToken, user, refreshToken, refreshExpiresAt } = await authService.login(req.body, req);
  setAuthCookies(res, refreshToken, refreshExpiresAt);
  noStore(res);
  return ok(res, { accessToken, user }, 'ورود با موفقیت انجام شد');
});

export const csrfToken = asyncHandler(async (req, res) => {
  const token = randomToken(32);
  const expires = new Date(Date.now() + AUTH.REFRESH_DAYS * 24 * 60 * 60 * 1000);
  res.cookie(COOKIE.CSRF, token, csrfCookieOptions(expires));
  noStore(res);
  return ok(res, { csrfToken: token });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = readRefreshCookie(req);
  try {
    const { accessToken, user, refreshToken, refreshExpiresAt } = await authService.refresh(raw, req);
    setAuthCookies(res, refreshToken, refreshExpiresAt);
    noStore(res);
    return ok(res, { accessToken, user });
  } catch (err) {
    if (err instanceof AppError && (err.status === 401 || err.statusCode === 401)) {
      clearAuthCookies(res);
    }
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  const raw = readRefreshCookie(req);
  await authService.logout(raw, req);
  clearAuthCookies(res);
  noStore(res);
  return ok(res, null, 'خروج با موفقیت انجام شد');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword, req);
  clearAuthCookies(res);
  noStore(res);
  return ok(res, null, 'رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.');
});