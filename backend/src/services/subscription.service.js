import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { sendExpiryReminderEmail, sendExpiredEmail } from './email.service.js';
import { AUDIT_ACTIONS, PAYMENT } from '../config/constants.js';

export async function getActiveSubscription(userId) {
  return prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
}

export function toPublicSubscription(sub) {
  if (!sub) return null;
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((new Date(sub.endsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    id: sub.id,
    status: sub.status,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt,
    daysRemaining,
    plan: sub.plan, // Assuming plan is already a public object
  };
}

export async function cancelSubscription(userId) {
  const sub = await getActiveSubscription(userId);
  if (!sub) throw new AppError(404, 'NOT_FOUND', 'اشتراک فعالی یافت نشد');
  
  const updatedSub = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELED', canceledAt: new Date() }
  });

  await logEvent({ userId, action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED, entity: 'Subscription', entityId: sub.id });
  return updatedSub;
}

export async function activateSubscription(tx, { userId, planId, paymentId }) {
  const plan = await tx.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');

  const currentSub = await tx.subscription.findFirst({
    where: { userId, status: 'ACTIVE' }
  });

  let newSub;
  const now = new Date();

  if (currentSub) {
    // اگر اشتراک فعال دارد، تمدید می‌کنیم
    const baseDate = new Date(currentSub.endsAt) > now ? new Date(currentSub.endsAt) : now;
    const newEndsAt = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    
    newSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: { planId, endsAt: newEndsAt, paymentId }
    });
  } else {
    // اگر اشتراک ندارد، جدید می‌سازیم
    const endsAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    newSub = await tx.subscription.create({
      data: { userId, planId, paymentId, startsAt: now, endsAt, status: 'ACTIVE' }
    });
  }
  
  return newSub;
}

export async function expireDueSubscriptions() {
  const now = new Date();
  const dueSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endsAt: { lt: now } },
    include: { user: true }
  });

  for (const sub of dueSubs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' }
    });
    
    await createNotification({ 
      userId: sub.userId, 
      type: 'SUBSCRIPTION_EXPIRED', 
      title: 'اشتراک منقضی شد', 
      body: 'اشتراک شما به پایان رسید. برای ادامه استفاده، لطفا پلن جدیدی خریداری کنید.' 
    });
    
    await logEvent({ userId: sub.userId, action: AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED, entity: 'Subscription', entityId: sub.id });
    
    if (sub.user?.email) {
      await sendExpiredEmail(sub.user);
    }
  }
  return dueSubs.length;
}

export async function sendExpiryReminders() {
  const remindDate = new Date();
  remindDate.setDate(remindDate.getDate() + PAYMENT.REMINDER_DAYS_BEFORE);
  
  const subs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: { lte: remindDate, gt: new Date() },
      reminderSentAt: null
    },
    include: { user: true, plan: true }
  });

  for (const sub of subs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { reminderSentAt: new Date() }
    });
    
    await createNotification({ 
      userId: sub.userId, 
      type: 'SUBSCRIPTION_EXPIRING', 
      title: 'یادآوری انقضا', 
      body: `اشتراک ${sub.plan.name} شما تا ${PAYMENT.REMINDER_DAYS_BEFORE} روز دیگر به پایان می‌رسد.` 
    });
    
    if (sub.user?.email) {
      await sendExpiryReminderEmail(sub.user, sub);
    }
  }
  return subs.length;
}