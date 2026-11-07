import prisma from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/hash.util.js';
import { signAccessToken, generateRefreshToken, hashToken } from '../utils/jwt.util.js';
import { AppError } from '../utils/response.util.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { AUDIT_ACTIONS, AUTH } from '../config/constants.js';

export async function toPublicUser(dbUser) {
  if (!dbUser) return null;
  const { passwordHash, ...publicUser } = dbUser;
  return publicUser;
}

export async function register(data) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'CONFLICT', 'این ایمیل قبلا ثبت شده است');
  
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: 'USER'
    }
  });
  
  await logEvent({ action: AUDIT_ACTIONS.REGISTER, entity: 'User', entityId: user.id });
  return toPublicUser(user);
}

export async function login(email, password, req) {
  const user = await prisma.user.findUnique({ where: { email } });
  
  // Timing safety: Compare against dummy hash if user doesn't exist
  const dummyHash = '$2b$12$dummyhashdummyhashdummyhashdummyhashdummyha';
  const isValid = user ? await comparePassword(password, user.passwordHash) : await comparePassword(password, dummyHash);

  if (!user || !isValid) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      const lockedUntil = failed >= AUTH.MAX_FAILED ? new Date(Date.now() + AUTH.LOCK_MINUTES * 60000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failed, lockedUntil }
      });
      await logEvent({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_FAILED, req });
    }
    throw new AppError(401, 'UNAUTHORIZED', 'ایمیل یا رمز عبور اشتباه است');
  }

  if (!user.isActive) throw new AppError(403, 'FORBIDDEN', 'حساب کاربری غیرفعال است');
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', 'حساب کاربری موقتا قفل شده است');
  }

  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken();
  
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    })
  ]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  await logEvent({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_SUCCESS, req });

  return { accessToken, refreshToken, user: toPublicUser(user) };
}

export async function refresh(oldRefreshToken, req) {
  if (!oldRefreshToken) throw new AppError(401, 'UNAUTHORIZED', 'توکن یافت نشد');
  
  const tokenHash = hashToken(oldRefreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    if (storedToken && storedToken.revokedAt) {
      // Reuse detection: Revoke all tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await logEvent({ userId: storedToken.userId, action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED, req });
    }
    throw new AppError(401, 'UNAUTHORIZED', 'توکن نامعتبر است');
  }

  // Rotate token
  const { token: newRefreshToken, tokenHash: newHash, expiresAt } = generateRefreshToken();
  
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    }),
    prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newHash,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    })
  ]);

  const accessToken = signAccessToken({ sub: storedToken.user.id, role: storedToken.user.role });
  await logEvent({ userId: storedToken.userId, action: AUDIT_ACTIONS.TOKEN_REFRESH, req });

  return { accessToken, refreshToken: newRefreshToken, user: toPublicUser(storedToken.user) };
}

export async function logout(refreshToken) {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken) },
      data: { revokedAt: new Date() }
    });
  }
}

export async function changePassword(userId, currentPassword, newPassword, req) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) throw new AppError(400, 'VALIDATION_ERROR', 'رمز عبور فعلی اشتباه است');

  const newHash = await hashPassword(newPassword);
  
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash }
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);

  await logEvent({ userId, action: AUDIT_ACTIONS.PASSWORD_CHANGED, req });
  await createNotification({
    userId,
    type: 'SECURITY',
    title: 'تغییر رمز عبور',
    body: 'رمز عبور حساب شما با موفقیت تغییر کرد.'
  });
}