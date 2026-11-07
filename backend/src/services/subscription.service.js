import prisma from '../config/database.js';
import { AUDIT_ACTIONS, PAYMENT } from '../config/constants.js';
import { AppError } from '../utils/response.util.js';
import { toPublicPlan } from './plan.service.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { sendExpiredEmail, sendExpiryReminderEmail } from './email.service.js';

export function toPublicSubscription(sub) {
  if (!sub) return null;

  const now = new Date();
  const ends = new Date(sub.endsAt);
  const diffDays = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    id: sub.id,
    status: sub.status,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt,
    daysRemaining: diffDays,
    plan: sub.plan ? toPublicPlan(sub.plan) : null,
  };
}

export async function getActiveSubscription(userId) {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      plan: true,
    },
  });

  if (!sub) {
    return null;
  }

  return toPublicSubscription(sub);
}

export async function cancelSubscription(userId, req) {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      plan: true,
    },
  });

  if (!sub) {
    throw new AppError(404, 'NOT_FOUND', 'اشتراک فعالی برای لغو یافت نشد');
  }

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      canceledAt: new Date(),
    },
    include: {
      plan: true,
    },
  });

  await logEvent({
    userId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
    entity: 'Subscription',
    entityId: sub.id,
    req,
  });

  return toPublicSubscription(updated);
}

export async function activateSubscription(tx, { userId, planId, paymentId }) {
  const client = tx || prisma;

  const plan = await client.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'پلن مربوط به اشتراک یافت نشد');
  }

  const existing = await client.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
  });

  const now = new Date();
  const durationMs = plan.durationDays * 24 * 60 * 60 * 1000;

  if (existing) {
    const currentEndsAt = new Date(existing.endsAt);
    const baseDate = currentEndsAt > now ? currentEndsAt : now;
    const newEndsAt = new Date(baseDate.getTime() + durationMs);

    return await client.subscription.update({
      where: { id: existing.id },
      data: {
        planId,
        endsAt: newEndsAt,
        canceledAt: null,
        reminderSentAt: null,
      },
      include: {
        plan: true,
      },
    });
  }

  const endsAt = new Date(now.getTime() + durationMs);

  return await client.subscription.create({
    data: {
      userId,
      planId,
      paymentId,
      status: 'ACTIVE',
      startsAt: now,
      endsAt,
    },
    include: {
      plan: true,
    },
  });
}

export async function expireDueSubscriptions() {
  const now = new Date();

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: {
        lt: now,
      },
    },
    include: {
      user: true,
      plan: true,
    },
  });

  for (const sub of dueSubscriptions) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });

      await createNotification({
        userId: sub.userId,
        type: 'SUBSCRIPTION_EXPIRED',
        title: 'انقضای اشتراک',
        body: `اشتراک شما برای پلن «${sub.plan.name}» به پایان رسید.`,
      });

      if (sub.user?.email) {
        await sendExpiredEmail(sub.user);
      }

      await logEvent({
        userId: sub.userId,
        action: AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED,
        entity: 'Subscription',
        entityId: sub.id,
        metadata: {
          planId: sub.planId,
          planName: sub.plan.name,
        },
      });
    } catch {
      // Continue processing other subscriptions
    }
  }

  return dueSubscriptions.length;
}

export async function sendExpiryReminders() {
  const now = new Date();
  const reminderThreshold = new Date(
    now.getTime() + PAYMENT.REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000
  );

  const subscriptionsToRemind = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      canceledAt: null,
      reminderSentAt: null,
      endsAt: {
        gte: now,
        lte: reminderThreshold,
      },
    },
    include: {
      user: true,
      plan: true,
    },
  });

  for (const sub of subscriptionsToRemind) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { reminderSentAt: new Date() },
      });

      await createNotification({
        userId: sub.userId,
        type: 'SUBSCRIPTION_EXPIRING',
        title: 'یادآوری پایان مهلت اشتراک',
        body: `اشتراک پلن «${sub.plan.name}» شما تا کمتر از ${PAYMENT.REMINDER_DAYS_BEFORE} روز دیگر به پایان می‌رسد.`,
      });

      if (sub.user?.email) {
        await sendExpiryReminderEmail(sub.user, sub);
      }
    } catch {
      // Continue processing other reminders
    }
  }

  return subscriptionsToRemind.length;
}