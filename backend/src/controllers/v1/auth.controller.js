import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok, created } from '../../utils/response.util.js';
import { register, login, refresh, logout, changePassword } from '../../services/auth.service.js';

function readRefreshToken(req) { return req.body?.refreshToken ?? null; }

export const registerMobile = asyncHandler(async (req, res) => {
  await register(req.body);
  // Sign the new account in immediately: the mobile client would otherwise
  // have to make a second request, and a failure between the two calls left a
  // freshly registered user without a usable session.
  const result = await login({ email: req.body.email, password: req.body.password });
  return created(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenType: 'Bearer',
    user: result.user,
  }, 'ثبت‌نام با موفقیت انجام شد');
});

export const loginMobile = asyncHandler(async (req, res) => {
  const result = await login(req.body);
  return ok(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenType: 'Bearer',
    user: result.user,
  }, 'ورود موفق بود');
});

export const refreshMobile = asyncHandler(async (req, res) => {
  const result = await refresh(readRefreshToken(req), req);
  return ok(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenType: 'Bearer',
    user: result.user,
  }, 'نشست تمدید شد');
});

export const logoutMobile = asyncHandler(async (req, res) => {
  await logout(readRefreshToken(req));
  return ok(res, null, 'خروج با موفقیت انجام شد');
});

export const changePasswordMobile = asyncHandler(async (req, res) => {
  await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req);
  return ok(res, null, 'رمز عبور تغییر کرد');
});
