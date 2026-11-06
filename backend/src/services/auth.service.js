import prisma from '../config/database.js';
import { AUTH, AUDIT_ACTIONS } from '../config/constants.js';
import { AppError } from '../utils/response.util.js';
import { signAccessToken, generateRefreshToken, hashToken } from '../utils/jwt.util.js';
import { hashPassword, comparePassword, encrypt, decrypt } from '../utils/hash.util.js';
import logger from '../utils/logger.util.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';

const MSG = {
  BAD_CREDENTIALS: 'ایمیل یا رمز عبور نادرست است',
  LOCKED: 'حساب کاربری شما به دلیل تلاش‌های ناموفق متعدد موقتاً قفل شده است. لطفاً بعداً دوباره تلاش کنید.',
  INACTIVE: 'حساب کاربری شما غیرفعال شده است',
  DUPLICATE: 'این ایمیل قبلاً ثبت شده است',
  BAD_SESSION: 'نشست نامعتبر است. لطفاً دوباره وارد شوید.',
  BAD_CURRENT_PASSWORD: 'رمز عبور فعلی نادرست است',
  SAME_PASSWORD: 'رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد',
};

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const invalidCredentials = () => new AppError(401, 'UNAUTHORIZED', MSG.BAD_CREDENTIALS);
const invalidSession = () => new AppError(401, 'UNAUTHORIZED', MSG.BAD_SESSION);

// Lazily computed bcrypt hash used to equalize timing when the email is unknown.
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('dummy-password-for-timing-safety-Aa1');
  }
  return dummyHashPromise;
}

function clientMeta(req) {
  const ip = req?.ip ?? null;
  const ua = req?.get?.('user-agent') ?? req?.headers?.['user-agent'] ?? null;
  return { ip, userAgent: ua ? String(ua).slice(0, 255) : null };
}

export function toPublicUser(dbUser) {
  let phone = null;
  if (dbUser.phoneEncrypted) {
    try {
      phone = decrypt(dbUser.phoneEncrypted);
    } catch (err) {
      logger.warn('Failed to decrypt user phone', { userId: dbUser.id, error: err?.message });
      phone = null;
    }
  }
  // Explicit whitelist: passwordHash, phoneEncrypted, failedLoginCount, lockedUntil, etc. never leak.
  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    phone,
    avatarUrl: dbUser.avatarUrl ?? null,
    role: dbUser.role,
    isActive: dbUser.isActive,
    createdAt: dbUser.createdAt,
    lastLoginAt: dbUser.lastLoginAt ?? null,
  };
}

function newRefreshRowData(userId, req) {
  const { token, tokenHash, expiresAt } = generateRefreshToken();
  const { ip, userAgent } = clientMeta(req);
  return { raw: token, expiresAt, data: { userId, tokenHash, expiresAt, ip, userAgent } };
}

async function issueSession(user, req) {
  const { raw, expiresAt, data } = newRefreshRowData(user.id, req);
  await prisma.refreshToken.create({ data });
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return { accessToken, refreshToken: raw, refreshExpiresAt: expiresAt };
}

async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function register({ email, password, fullName, phone }, req) {
  const normalized = normalizeEmail(email);

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new AppError(409, 'CONFLICT', MSG.DUPLICATE);

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        fullName: fullName.trim(),
        phoneEncrypted: phone ? encrypt(phone) : null,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw new AppError(409, 'CONFLICT', MSG.DUPLICATE);
    throw err;
  }

  await logEvent({
    userId: user.id,
    action: AUDIT_ACTIONS.REGISTER,
    entity: 'User',
    entityId: user.id,
    req,
  });

  return toPublicUser(user);
}

export async function login({ email, password }, req) {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    // Timing safety: always perform a bcrypt comparison.
    await comparePassword(password, await getDummyHash());
    await logEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      req,
      metadata: { reason: 'UNKNOWN_EMAIL', email: normalized },
    });
    throw invalidCredentials();
  }

  const now = new Date();

  if (user.lockedUntil && user.lockedUntil > now) {
    await logEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_LOCKED,
      entity: 'User',
      entityId: user.id,
      req,
      metadata: { lockedUntil: user.lockedUntil, reason: 'ATTEMPT_WHILE_LOCKED' },
    });
    throw new AppError(423, 'ACCOUNT_LOCKED', MSG.LOCKED);
  }

  if (user.lockedUntil) {
    // Lock expired: start counting from zero again.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  const valid = await comparePassword(password, user.passwordHash);

  if (!valid) {
    const { failedLoginCount } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    await logEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: 'User',
      entityId: user.id,
      req,
      metadata: { attempts: failedLoginCount },
    });

    if (failedLoginCount >= AUTH.MAX_FAILED) {
      const lockedUntil = new Date(Date.now() + AUTH.LOCK_MINUTES * 60 * 1000);
      await prisma.user.update({ where: { id: user.id }, data: { lockedUntil } });
      await logEvent({
        userId: user.id,
        action: AUDIT_ACTIONS.LOGIN_LOCKED,
        entity: 'User',
        entityId: user.id,
        req,
        metadata: { lockedUntil, attempts: failedLoginCount },
      });
      throw new AppError(423, 'ACCOUNT_LOCKED', MSG.LOCKED);
    }

    throw invalidCredentials();
  }

  if (!user.isActive) {
    await logEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: 'User',
      entityId: user.id,
      req,
      metadata: { reason: 'INACTIVE' },
    });
    throw new AppError(403, 'FORBIDDEN', MSG.INACTIVE);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });

  const session = await issueSession(updated, req);

  await logEvent({
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entity: 'User',
    entityId: user.id,
    req,
  });

  return { ...session, user: toPublicUser(updated) };
}

async function handleReuse(stored, req) {
  await revokeAllUserTokens(stored.userId);
  logger.warn('Refresh token reuse detected; all tokens revoked', { userId: stored.userId });
  await logEvent({
    userId: stored.userId,
    action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
    entity: 'RefreshToken',
    entityId: stored.id,
    req,
  });
  throw invalidSession();
}

export async function refresh(rawRefreshToken, req) {
  if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length === 0 || rawRefreshToken.length > 256) {
    throw invalidSession();
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    include: { user: true },
  });
  if (!stored) throw invalidSession();

  if (stored.revokedAt) return handleReuse(stored, req);

  const now = new Date();
  if (stored.expiresAt <= now) throw invalidSession();

  const user = stored.user;
  if (!user.isActive) {
    await revokeAllUserTokens(user.id);
    throw new AppError(403, 'FORBIDDEN', MSG.INACTIVE);
  }

  const next = newRefreshRowData(user.id, req);

  // Atomic rotation: only one concurrent caller can claim the old token.
  const newRow = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (claimed.count === 0) return null;
    const row = await tx.refreshToken.create({ data: next.data });
    await tx.refreshToken.update({ where: { id: stored.id }, data: { replacedById: row.id } });
    return row;
  });

  if (!newRow) return handleReuse(stored, req);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  await logEvent({
    userId: user.id,
    action: AUDIT_ACTIONS.TOKEN_REFRESH,
    entity: 'RefreshToken',
    entityId: newRow.id,
    req,
  });

  return {
    accessToken,
    user: toPublicUser(user),
    refreshToken: next.raw,
    refreshExpiresAt: next.expiresAt,
  };
}

export async function logout(rawRefreshToken, req) {
  if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length === 0 || rawRefreshToken.length > 256) {
    return;
  }
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) return; // idempotent

  if (!stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await logEvent({
    userId: stored.userId,
    action: AUDIT_ACTIONS.LOGOUT,
    entity: 'RefreshToken',
    entityId: stored.id,
    req,
  });
}

export async function changePassword(userId, currentPassword, newPassword, req) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', MSG.BAD_SESSION);
  if (!user.isActive) throw new AppError(403, 'FORBIDDEN', MSG.INACTIVE);

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(400, 'VALIDATION_ERROR', MSG.BAD_CURRENT_PASSWORD, [
      { field: 'currentPassword', message: MSG.BAD_CURRENT_PASSWORD },
    ]);
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'VALIDATION_ERROR', MSG.SAME_PASSWORD, [
      { field: 'newPassword', message: MSG.SAME_PASSWORD },
    ]);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logEvent({
    userId,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entity: 'User',
    entityId: userId,
    req,
  });

  try {
    await createNotification({
      userId,
      type: 'SECURITY',
      title: 'رمز عبور تغییر کرد',
      body: 'رمز عبور حساب شما با موفقیت تغییر کرد و تمام نشست‌های فعال بسته شدند. اگر این کار را شما انجام نداده‌اید، بلافاصله با پشتیبانی تماس بگیرید.',
    });
  } catch (err) {
    logger.error('Failed to create security notification', { userId, error: err?.message });
  }
}