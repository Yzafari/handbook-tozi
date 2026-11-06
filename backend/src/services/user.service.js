import fs from 'fs';
import path from 'path';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { AppError } from '../utils/response.util.js';
import { encrypt } from '../utils/hash.util.js';
import { logEvent } from './audit.service.js';
import { toPublicUser } from './auth.service.js';
import { getActiveSubscription } from './subscription.service.js';

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');
  }

  return { user: toPublicUser(user) };
}

export async function updateMe(userId, { fullName, phone }, req) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');
  }

  const updateData = {};
  if (fullName !== undefined) {
    updateData.fullName = fullName;
  }
  if (phone !== undefined) {
    updateData.phoneEncrypted = phone ? encrypt(phone) : null;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  await logEvent({
    userId,
    action: AUDIT_ACTIONS.PROFILE_UPDATED,
    entity: 'User',
    entityId: userId,
    req,
    metadata: {
      updatedFields: Object.keys(updateData),
    },
  });

  return { user: toPublicUser(updated) };
}

export async function saveAvatar(userId, file, req) {
  if (!file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'فایل آواتار الزامی است');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');
  }

  const avatarUrl = `/uploads/${file.filename}`;

  if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
    const oldFileName = path.basename(user.avatarUrl);
    const oldFilePath = path.join(process.cwd(), env.UPLOAD_DIR, oldFileName);
    try {
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    } catch {
      // Ignored: cleanup failure should not block upload
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

  await logEvent({
    userId,
    action: AUDIT_ACTIONS.AVATAR_UPDATED,
    entity: 'User',
    entityId: userId,
    req,
    metadata: { avatarUrl },
  });

  return { avatarUrl };
}

export async function getDashboard(userId) {
  const subscription = await getActiveSubscription(userId);

  const payments = await prisma.payment.findMany({
    where: {
      userId,
      status: 'SUCCESS',
    },
    select: {
      amountToman: true,
    },
  });

  const totalPayments = payments.length;
  const totalSpentToman = payments.reduce((acc, p) => acc + p.amountToman, 0);
  const daysRemaining = subscription ? subscription.daysRemaining : 0;

  const unreadNotifications = await prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });

  return {
    subscription,
    stats: {
      totalPayments,
      totalSpentToman,
      daysRemaining,
    },
    unreadNotifications,
  };
}

export async function listPayments(userId, { page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where: { userId } }),
    prisma.payment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const formattedPayments = payments.map((p) => ({
    id: p.id,
    planId: p.planId,
    planName: p.plan?.name || '',
    amountToman: p.amountToman,
    status: p.status,
    refId: p.refId,
    cardPanMasked: p.cardPanMasked,
    createdAt: p.createdAt,
    verifiedAt: p.verifiedAt,
  }));

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    payments: formattedPayments,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function listNotifications(userId, { page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    notifications,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new AppError(404, 'NOT_FOUND', 'اعلان یافت نشد');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
  });

  return { notification: updated };
}