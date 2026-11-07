import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { sendExpiryReminderEmail, sendExpiredEmail } from './email.service.js';
import { AUDIT_ACTIONS, PAYMENT } from '../config/constants.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_DAYS = 30;

function toDate(value) {
  return value ? new Date(value) : null;
}

function daysRemaining(endDate, now = new Date()) {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS));
}

export async function getActiveSubscription(userId) {
  return prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', endDate: { gt: new Date() } },
    include: { plan: true },
    orderBy: { endDate: 'desc' },
  });
}

export function toPublicSubscription(sub) {
  if (!sub) return null;
  const endDate = toDate(sub.endDate);
  return {
    id: sub.id,
    status: sub.status,
    startsAt: sub.startDate,
    endsAt: endDate,
    daysRemaining: daysRemaining(endDate),
    plan: sub.plan ?? null,
  };
}

export async function cancelSubscription(userId) {
  const sub = await getActiveSubscription(userId);
  if (!sub) throw new AppError(404, 'NOT_FOUND', 'اشتراک فعالی یافت نشد');

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED' },
  });

  await logEvent({
    userId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
    entity: 'Subscription',
    entityId: sub.id,
  });

  return toPublicSubscription({ ...updated, plan: sub.plan });
}

export async function activateSubscription(tx, { userId, planId, durationDays }) {
  const client = tx ?? prisma;

  const plan = await client.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');

  const days = Number(durationDays) > 0 ? Number(durationDays) : DEFAULT_DURATION_DAYS;
  const now = new Date();

  const currentSub = await client.subscription.findFirst({
    where: { userId, status: 'ACTIVE', endDate: { gt: now } },
    orderBy: { endDate: 'desc' },
  });

  if (currentSub) {
    const base = currentSub.endDate && currentSub.endDate > now ? currentSub.endDate : now;
    return client.subscription.update({
      where: { id: currentSub.id },
      data: { planId, endDate: new Date(base.getTime() + days * DAY_MS) },
    });
  }

  return client.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      startDate: now,
      endDate: new Date(now.getTime() + days * DAY_MS),
    },
  });
}

export async function expireDueSubscriptions() {
  const now = new Date();

  const dueSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endDate: { lt: now } },
    include: { user: true },
  });

  let processed = 0;

  for (const sub of dueSubs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });

    await createNotification({
      userId: sub.userId,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'اشتراک منقضی شد',
      body: 'اشتراک شما به پایان رسید. برای ادامه استفاده، لطفا پلن جدیدی خریداری کنید.',
    });

    await logEvent({
      userId: sub.userId,
      action: AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED,
      entity: 'Subscription',
      entityId: sub.id,
    });

    if (sub.user?.email) {
      await sendExpiredEmail(sub.user);
    }

    processed += 1;
  }

  return processed;
}

export async function sendExpiryReminders() {
  const now = new Date();
  const threshold = new Date(now.getTime() + PAYMENT.REMINDER_DAYS_BEFORE * DAY_MS);

  const subs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gt: now, lte: threshold },
    },
    include: { user: true, plan: true },
  });

  let processed = 0;

  for (const sub of subs) {
    await createNotification({
      userId: sub.userId,
      type: 'SUBSCRIPTION_EXPIRING',
      title: 'یادآوری انقضا',
      body: `اشتراک ${sub.plan?.name ?? ''} شما تا ${PAYMENT.REMINDER_DAYS_BEFORE} روز دیگر به پایان می‌رسد.`,
    });

    if (sub.user?.email) {
      await sendExpiryReminderEmail(sub.user);
    }

    processed += 1;
  }

  return processed;
}
