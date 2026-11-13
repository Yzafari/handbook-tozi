import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { encrypt, decrypt } from '../utils/hash.util.js';
import { toPublicSubscription } from './subscription.service.js';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

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
  const { password, phoneEncrypted, failedLoginCount, lockedUntil, ...publicUser } = user;
  return { ...publicUser, phone };
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
  if (data.phone) updateData.phoneEncrypted = encrypt(data.phone);

  if (Object.keys(updateData).length === 0) {
    return getMe(userId);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return getMe(updatedUser.id);
}

export async function saveAvatar(userId, file) {
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'فایلی ارسال نشده است');

  const oldUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!oldUser) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  // حذف آواتار قبلی اگر وجود داشت
  if (oldUser.avatarUrl) {
    // path.join (not path.resolve) so a leading "/" in avatarUrl is treated as
    // relative to the project root, then resolve for the containment check.
    const oldPath = path.resolve(path.join(process.cwd(), oldUser.avatarUrl));
    // Only ever delete files that live inside the uploads directory.
    if (oldPath.startsWith(path.resolve(UPLOADS_ROOT) + path.sep) && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const avatarUrl = `/uploads/${file.filename}`;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

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

  // ۲. آمار پرداخت‌ها (اصلاح شد با PaymentStatus.COMPLETED)
  const payments = await prisma.payment.findMany({
    where: { 
      userId, 
      status: PaymentStatus.COMPLETED 
    },
  });

  const totalPayments = payments.length;
  const totalSpentToman = payments.reduce((sum, p) => sum + p.amountToman, 0);

  // ۳. اعلان‌های خوانده نشده
  const unreadNotifications = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  const publicSubscription = subscription ? formatPublicSubscription(subscription) : null;

  return {
    subscription: publicSubscription,
    stats: {
      totalPayments,
      totalSpentToman,
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
