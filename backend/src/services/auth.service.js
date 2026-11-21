
import prisma from '../config/database.js';
import { hashPassword, comparePassword, encrypt } from '../utils/hash.util.js';

import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from '../utils/jwt.util.js';

import { AppError } from '../utils/response.util.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { deleteCachedJson } from './cache/redis-cache.js';
import { AUDIT_ACTIONS, AUTH } from '../config/constants.js';

// Dummy hash for timing protection when the account does not exist.
// It is produced once with the same cost factor as real passwords, so a login
// attempt for an unknown email costs the same as a wrong password. A hardcoded
// hash with a different cost would leak timing information about valid emails.
let dummyHashPromise = null;
function getDummyHash() {
  dummyHashPromise ??= hashPassword('timing-protection-dummy-password');
  return dummyHashPromise;
}

/**
 * Convert Prisma user into a safe public user object.
 *
 * IMPORTANT:
 * This function MUST NOT be async.
 * Returning a Promise here caused Express JSON serialization
 * to produce an empty user object: {}.
 */
export function toPublicUser(dbUser) {
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    fullName: dbUser.name,
    role: dbUser.role,
    jobRole: dbUser.jobRole ?? null,
    province: dbUser.province ?? null,
    createdAt: dbUser.createdAt,
  };
}

/**
 * Register a new user.
 */
export async function register(data) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new AppError(
      409,
      'CONFLICT',
      'این ایمیل قبلا ثبت شده است'
    );
  }

  const passwordHash = await hashPassword(
    data.password || data.passwordHash
  );

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: passwordHash,
      name: data.fullName || data.name || 'کاربر جدید',
      jobRole: data.jobRole ?? null,
      province: data.province ?? null,
      phoneEncrypted: data.phone ? encrypt(data.phone) : null,
      role: 'USER',
    },
  });

  await logEvent({
    action: AUDIT_ACTIONS.REGISTER,
    entity: 'User',
    entityId: user.id,
  });

  return toPublicUser(user);
}

/**
 * Login.
 */
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  const now = new Date();
  if (user?.lockedUntil && user.lockedUntil > now) {
    throw new AppError(423, 'ACCOUNT_LOCKED', 'حساب کاربری موقتا قفل شده است');
  }

  // A previous lock has expired: start a fresh failure window.
  if (user?.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    user.failedLoginCount = 0;
    user.lockedUntil = null;
  }

  // Timing protection: perform a dummy hash comparison for unknown accounts.
  const isValid = user
    ? await comparePassword(password, user.password)
    : await comparePassword(password, await getDummyHash());

  if (!user || !isValid || user.isActive === false) {
    if (user && user.isActive !== false) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      if (updated.failedLoginCount >= AUTH.MAX_FAILED) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + AUTH.LOCK_MINUTES * 60000) },
        });
      }
      await logEvent({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_FAILED });
    }
    throw new AppError(401, 'UNAUTHORIZED', 'ایمیل یا رمز عبور اشتباه است');
  }

  const {
    token: refreshToken,
    tokenHash,
    expiresAt,
  } = generateRefreshToken();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    }),

    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: null,
        userAgent: null,
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    jobRole: user.jobRole ?? null,
    tokenVersion: user.tokenVersion ?? 0,
  });

  await logEvent({
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
  });

  // CRITICAL FIX:
  // toPublicUser now returns a plain object, not a Promise.
  return {
    accessToken,
    refreshToken,
    user: toPublicUser(user),
  };
}

/**
 * Refresh access token.
 */
export async function refresh(oldRefreshToken, req) {
  if (!oldRefreshToken) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'توکن یافت نشد'
    );
  }

  const tokenHash = hashToken(oldRefreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !storedToken ||
    storedToken.user?.isActive === false ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    if (storedToken && storedToken.revokedAt) {
      await prisma.$transaction([
        prisma.refreshToken.updateMany({ where: { userId: storedToken.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.user.update({ where: { id: storedToken.userId }, data: { tokenVersion: { increment: 1 } } }),
      ]);
      await deleteCachedJson(`auth:user:${storedToken.userId}`);

      await logEvent({
        userId: storedToken.userId,
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        req,
      });
    }

    throw new AppError(
      401,
      'UNAUTHORIZED',
      'توکن نامعتبر است'
    );
  }

  const {
    token: newRefreshToken,
    tokenHash: newHash,
    expiresAt,
  } = generateRefreshToken();

  const rotated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (claimed.count !== 1) {
      await tx.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return false;
    }
    await tx.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newHash,
        expiresAt,
        ip: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent'] ?? null,
      },
    });
    return true;
  });
  if (!rotated) throw new AppError(401, 'UNAUTHORIZED', 'توکن قبلاً استفاده یا باطل شده است');

  const accessToken = signAccessToken({
    sub: storedToken.user.id,
    role: storedToken.user.role,
    jobRole: storedToken.user.jobRole ?? null,
    tokenVersion: storedToken.user.tokenVersion ?? 0,
  });

  await logEvent({
    userId: storedToken.userId,
    action: AUDIT_ACTIONS.TOKEN_REFRESH,
    req,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: toPublicUser(storedToken.user),
  };
}

/**
 * Logout.
 */
export async function logout(refreshToken) {
  if (!refreshToken) return;

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(refreshToken),
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Change password.
 */
export async function changePassword(
  userId,
  currentPassword,
  newPassword,
  req
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'کاربر یافت نشد'
    );
  }

  // Prisma schema column is password, not passwordHash.
  const isValid = await comparePassword(
    currentPassword,
    user.password
  );

  if (!isValid) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'رمز عبور فعلی اشتباه است'
    );
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        tokenVersion: { increment: 1 },
      },
    }),

    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);

  await deleteCachedJson(`auth:user:${userId}`);
  await logEvent({
    userId,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    req,
  });

  await createNotification({
    userId,
    type: 'SECURITY',
    title: 'تغییر رمز عبور',
    body: 'رمز عبور حساب شما با موفقیت تغییر کرد.',
  });
}

// Backward compatibility.
export const registerUser = register;
