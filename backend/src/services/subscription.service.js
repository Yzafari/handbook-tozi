import prisma from '../prisma/prisma-client.js';
import { sendExpiredEmail } from '../services/email.service.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.util.js';

export async function getActiveSubscription(userId) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active',
    },
  });
}

export async function toPublicSubscription(subscription) {
  if (!subscription) return null;
  const { id, userId, planId, status, expiresAt, createdAt, updatedAt } = subscription;
  return { id, userId, planId, status, expiresAt, createdAt, updatedAt };
}

export async function cancelSubscription(subscriptionId) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'cancelled' },
  });
}

export async function activateSubscription(subscriptionId) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'active' },
  });
}

export async function expireDueSubscriptions() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      expiresAt: { lte: new Date() },
    },
  });

  for (const subscription of subscriptions) {
    await cancelSubscription(subscription.id);
    await sendExpiredEmail(subscription.user);
  }
}

export async function sendExpiryReminders() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      expiresAt: { lte: new Date(new Date().setHours(new Date().getHours() + 24)) },
    },
  });

  for (const subscription of subscriptions) {
    await sendExpiryReminderEmail(subscription.user);
  }
}
