import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { encrypt, decrypt } from '../utils/hash.util.js';
import fs from 'fs';
import path from 'path';

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
  
  const { passwordHash, phoneEncrypted, ...publicUser } = user;
  return { ...publicUser, phone };
}

export async function updateMe(userId, data) {
  const updateData = {};
  if (data.fullName) updateData.fullName = data.fullName;
  if (data.phone) updateData.phoneEncrypted = encrypt(data.phone);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  return getMe(updatedUser.id);
}

export async function saveAvatar(userId, file) {
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'فایلی ارسال نشده است');
  
  const oldUser = await prisma.user.findUnique({ where: { id: userId } });
  
  // حذف آواتار قبلی اگر وجود داشت
  if (oldUser.avatarUrl) {
    const oldPath = path.join(process.cwd(), oldUser.avatarUrl);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const avatarUrl = `/uploads/${file.filename}`;
  
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl }
  });

  return { avatarUrl: user.avatarUrl };
}

export async function getDashboard(userId) {
  const now = new Date();
  
  // ۱. اشتراک فعال
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', endsAt: { gt: now } },
    include: { plan: true }
  });

  let daysRemaining = 0;
  if (subscription) {
    daysRemaining = Math.max(0, Math.ceil((subscription.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // ۲. آمار پرداخت‌ها
  const payments = await prisma.payment.findMany({
    where: { userId, status: 'SUCCESS' }
  });
  
  const totalPayments = payments.length;
  const totalSpentToman = payments.reduce((sum, p) => sum + p.amountToman, 0);

  // ۳. اعلان‌های خوانده نشده
  const unreadNotifications = await prisma.notification.count({
    where: { userId, readAt: null }
  });

  return {
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      daysRemaining,
      plan: subscription.plan
    } : null,
    stats: {
      totalPayments,
      totalSpentToman,
      daysRemaining
    },
    unreadNotifications
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
      include: { plan: true }
    }),
    prisma.payment.count({ where: { userId } })
  ]);

  const data = payments.map(p => ({
    id: p.id,
    planId: p.planId,
    planName: p.plan.name,
    amountToman: p.amountToman,
    status: p.status,
    refId: p.refId,
    cardPanMasked: p.cardPanMasked,
    createdAt: p.createdAt,
    verifiedAt: p.verifiedAt
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
      take: limit
    }),
    prisma.notification.count({ where: { userId } })
  ]);

  return { data: notifications, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId }
  });

  if (!notification) throw new AppError(404, 'NOT_FOUND', 'اعلان یافت نشد');
  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() }
  });
}