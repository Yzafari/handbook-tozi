import asyncHandler from '../utils/asyncHandler.util.js';
import { ok, created } from '../utils/response.util.js';
import { register, login, refresh, logout, changePassword } from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// `secure` must be off in local dev, otherwise the browser silently drops the
// cookie over plain HTTP and refresh/logout appear broken.
function refreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // در محیط توسعه روی http نباید secure برابر با true باشد
    secure: isProduction, 
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}


// The refresh token lives in an httpOnly cookie, so the browser cannot read it.
// Fall back to the body only for non-browser clients (mobile, server-to-server).
function readRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || null;
}

export const registerHandler = asyncHandler(async (req, res) => {
  const user = await register(req.body);
  return created(res, user, 'User registered successfully');
});

export const loginHandler = asyncHandler(async (req, res) => {
  const authResult = await login(req.body);
  
  // 👇 این خط را برای دیباگ اضافه کنید تا در ترمینال بک‌اند ببینید چه چیزی برمی‌گردد
  console.log('AUTH RESULT FROM SERVICE:', authResult);

  const { accessToken, refreshToken, user } = authResult;

  if (!refreshToken) {
    throw new Error('Refresh token is missing from auth service response!');
  }

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return ok(res, { token: accessToken, user }, 'Logged in successfully');
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await refresh(readRefreshToken(req), req);

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return ok(res, { token: accessToken, user }, 'Token refreshed successfully');
});

export const logoutHandler = asyncHandler(async (req, res) => {
  await logout(readRefreshToken(req));

  const { maxAge, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  return ok(res, null, 'Logged out successfully');
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  // Always use the authenticated identity. Never trust a userId from the body:
  // doing so lets any logged-in user change another account's password.
  await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req);
  return ok(res, null, 'Password changed successfully');
});
