import { register, login, refresh, logout, changePassword } from '../services/auth.service';
import { ok, created } from '../utils/response.util';

export async function registerHandler(req, res) {
  try {
    const user = await register(req.body);
    return created(res, user, 'User registered successfully');
  } catch (error) {
    return res.status(error.statusCode).json({ success: false, message: error.message, meta: error.meta });
  }
}

export async function loginHandler(req, res) {
  try {
    const { token, refreshToken } = await login(req.body.email, req.body.password, req);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });
    return ok(res, { token }, 'Logged in successfully');
  } catch (error) {
    return res.status(error.statusCode).json({ success: false, message: error.message, meta: error.meta });
  }
}

export async function refreshHandler(req, res) {
  try {
    const { token, refreshToken } = await refresh(req.body.refreshToken, req);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });
    return ok(res, { token }, 'Token refreshed successfully');
  } catch (error) {
    return res.status(error.statusCode).json({ success: false, message: error.message, meta: error.meta });
  }
}

export async function logoutHandler(req, res) {
  try {
    await logout(req.body.refreshToken);
    res.clearCookie('refreshToken');
    return ok(res, null, 'Logged out successfully');
  } catch (error) {
    return res.status(error.statusCode).json({ success: false, message: error.message, meta: error.meta });
  }
}

export async function changePasswordHandler(req, res) {
  try {
    await changePassword(req.body.userId, req.body.currentPassword, req.body.newPassword, req);
    return ok(res, null, 'Password changed successfully');
  } catch (error) {
    return res.status(error.statusCode).json({ success: false, message: error.message, meta: error.meta });
  }
}
