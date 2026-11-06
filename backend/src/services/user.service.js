import { prisma } from '../prisma';
import { toPublicUser } from './utils';

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user ? toPublicUser(user) : null;
}

export async function updateMe(userId, data) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });
  return toPublicUser(user);
}

export async function saveAvatar(userId, avatarUrl) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
  return toPublicUser(user);
}

export async function getDashboard(userId) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { userId },
  });
  return dashboard;
}

export async function listPayments(userId) {
  const payments = await prisma.payment.findMany({
    where: { userId },
  });
  return payments;
}

export async function listNotifications(userId) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
  });
  return notifications;
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
  return notification;
}
