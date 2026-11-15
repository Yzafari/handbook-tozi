import prisma from '../config/database.js';
import { deleteCachedJson } from './cache/redis-cache.js';
import { AppError } from '../utils/response.util.js';
import { encrypt, decrypt } from '../utils/hash.util.js';
import { toPublicSubscription } from './subscription.service.js';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../config/paths.js';

const UPLOADS_ROOT = UPLOADS_DIR;

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  let phone = null;
  if (user.phoneEncrypted) {
    try {
      phone = decrypt(user.phoneEncrypted);
    } catch (e) {
      phone = null;
    }
  }

  // The Prisma column is `password`, not `passwordHash`. Destructuring
  // `passwordHash` (which does not exist) stripped nothing and leaked the real
  // bcrypt hash in the response. Strip the real column plus the other internal
  // auth fields that the client has no use for.
  const { password, phoneEncrypted, failedLoginCount, lockedUntil, tokenVersion, ...publicUser } = user;
  return { ...publicUser, fullName: publicUser.name, phone };
}

export async function updateMe(userId, data) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const updateData = {};

  // The Prisma column is `name`. The API accepts `fullName` (used by the
  // register form) and `name`; writing `fullName` straight to Prisma throws
  // "Unknown argument" and turned PATCH /me into a 500.
  const name = data.fullName ?? data.name;
  if (name !== undefined) updateData.name = name;
  if (data.phone !== undefined) updateData.phoneEncrypted = data.phone ? encrypt(data.phone) : null;
  if (data.jobRole !== undefined) { updateData.jobRole = data.jobRole; if (data.jobRole !== existing.jobRole) updateData.tokenVersion = { increment: 1 }; }
  if (data.province !== undefined) updateData.province = data.province;

  if (Object.keys(updateData).length === 0) {
    return getMe(userId);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
  await deleteCachedJson(`auth:user:${userId}`);

  return getMe(updatedUser.id);
}

export async function saveAvatar(userId, file) {
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'فایلی ارسال نشده است');

  const signatures = {
    'image/jpeg': buffer => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': buffer => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/webp': buffer => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP',
    'image/gif': buffer => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString()),
  };
  let validImage = false;
  try {
    const handle = await fs.promises.open(file.path, 'r');
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      validImage = Boolean(signatures[file.mimetype]?.(header.subarray(0, bytesRead)));
    } finally { await handle.close(); }
  } catch { validImage = false; }
  if (!validImage) {
    await fs.promises.unlink(file.path).catch(() => {});
    throw new AppError(415, 'INVALID_FILE_CONTENT', 'محتوای فایل با فرمت تصویر اعلام‌شده مطابقت ندارد');
  }

  const oldUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!oldUser) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const avatarUrl = `/uploads/${file.filename}`;
  let user;
  try {
    user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => {});
    throw error;
  }

  // Update the DB reference first. A failed DB write must never delete the
  // currently referenced avatar. Only remove a basename inside the configured
  // upload directory; never follow a stored URL as a filesystem path.
  if (oldUser.avatarUrl) {
    const oldName = path.basename(oldUser.avatarUrl);
    const oldPath = path.resolve(UPLOADS_ROOT, oldName);
    if (oldPath.startsWith(path.resolve(UPLOADS_ROOT) + path.sep) && fs.existsSync(oldPath)) {
      await fs.promises.unlink(oldPath).catch(() => {});
    }
  }

  return { avatarUrl: user.avatarUrl };
}

export async function getDashboard(userId) {
  const now = new Date();

  // ۱. اشتراک فعال (اصلاح شد با SubscriptionStatus.ACTIVE)
  const subscription = await prisma.subscription.findFirst({
    where: { 
      userId, 
      status: SubscriptionStatus.ACTIVE, 
      endDate: { gt: now } 
    },
    include: { plan: true },
  });

  // ۲. آمار پرداخت‌ها (اصلاح شد با PaymentStatus.SUCCESS)
  const [paymentCount, paymentAmounts, unknownAmountPayments, unreadNotifications] = await Promise.all([
    prisma.payment.count({ where: { userId, status: PaymentStatus.SUCCESS } }),
    prisma.payment.aggregate({ where: { userId, status: PaymentStatus.SUCCESS }, _sum: { amountToman: true } }),
    prisma.payment.count({ where: { userId, status: PaymentStatus.SUCCESS, amountToman: null } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const totalPayments = paymentCount;
  // Historical payments with an unknown currency unit are intentionally excluded.
  const totalSpentToman = paymentAmounts._sum.amountToman ?? 0;

  const publicSubscription = subscription ? toPublicSubscription(subscription) : null;

  return {
    subscription: publicSubscription,
    stats: {
      totalPayments,
      totalSpentToman,
      unknownAmountPayments,
      daysRemaining: subscription ? Math.ceil((new Date(subscription.endDate) - now) / (1000 * 60 * 60 * 24)) : 0
    },
    unreadNotifications,
  };
}


export async function listPayments(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { plan: true },
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  const data = payments.map((p) => ({
    id: p.id,
    planId: p.planId,
    planName: p.plan?.name ?? null,
    amountToman: p.amountToman,
    status: p.status,
    refId: p.refId,
    cardPanMasked: p.cardPanMasked,
    createdAt: p.createdAt,
    verifiedAt: p.verifiedAt,
  }));

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listNotifications(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { data: notifications, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function markNotificationRead(userId, notificationId) {
  const id = Number(notificationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'شناسه اعلان نامعتبر است');
  }

  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) throw new AppError(404, 'NOT_FOUND', 'اعلان یافت نشد');
  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}
