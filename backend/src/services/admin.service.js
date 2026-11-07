import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { encrypt } from '../utils/hash.util.js';
import logger from '../utils/logger.util.js';
import { logEvent } from './audit.service.js';
import { toPublicPayment } from './payment.service.js';
import { toPublicSubscription } from './subscription.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVENUE_GROUPS = new Set(['day', 'week', 'month']);
const PAYMENT_SORT_FIELDS = new Set(['createdAt', 'amountToman', 'status']);

function parseId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} نامعتبر است`);
  }
  return id;
}

function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function safeLog(payload) {
  try {
    await logEvent(payload);
  } catch (error) {
    logger.error('Failed to write audit log:', error?.message);
  }
}

export async function getStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const [
    totalUsers,
    activeUsers,
    newUsersLast30Days,
    totalPayments,
    completedPayments,
    pendingPayments,
    failedPayments,
    revenueAgg,
    revenueLast30Agg,
    activeSubscriptions,
    totalPlans,
    activePlans,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountToman: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
      _sum: { amountToman: true },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gt: now } } }),
    prisma.plan.count(),
    prisma.plan.count({ where: { isActive: true } }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      newLast30Days: newUsersLast30Days,
    },
    payments: {
      total: totalPayments,
      completed: completedPayments,
      pending: pendingPayments,
      failed: failedPayments,
    },
    revenue: {
      totalToman: revenueAgg._sum.amountToman ?? 0,
      last30DaysToman: revenueLast30Agg._sum.amountToman ?? 0,
    },
    subscriptions: { active: activeSubscriptions },
    plans: { total: totalPlans, active: activePlans },
  };
}

export async function getRevenue({ from, to, groupBy = 'day', planId } = {}) {
  if (!REVENUE_GROUPS.has(groupBy)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'groupBy must be one of day, week, month');
  }

  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getTime() - 30 * DAY_MS);
  const end = to ? new Date(to) : now;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'بازه زمانی نامعتبر است');
  }
  if (start > end) {
    throw new AppError(400, 'VALIDATION_ERROR', 'from must be before or equal to to');
  }

  const normalizedPlanId = planId !== undefined && planId !== null ? Number(planId) : undefined;
  const planFilter =
    normalizedPlanId !== undefined
      ? Prisma.sql`AND "planId" = ${normalizedPlanId}`
      : Prisma.empty;

  const [totals, series] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
        ...(normalizedPlanId !== undefined ? { planId: normalizedPlanId } : {}),
      },
      _sum: { amountToman: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT date_trunc(${groupBy}::text, "createdAt") AS bucket,
             SUM("amountToman")::int AS revenue,
             COUNT(*)::int AS count
      FROM "Payment"
      WHERE "status" = 'COMPLETED'
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        ${planFilter}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  ]);

  return {
    range: { from: start, to: end, groupBy },
    totals: {
      revenueToman: totals._sum.amountToman ?? 0,
      payments: totals._count._all,
    },
    series: series.map((row) => ({
      bucket: row.bucket,
      revenueToman: Number(row.revenue),
      payments: Number(row.count),
    })),
  };
}

export async function listUsers({ page = 1, limit = 10, sortOrder = 'desc' } = {}) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count(),
  ]);

  return { data: users, meta: paginationMeta(page, limit, total) };
}

export async function getUserDetails(userId) {
  const id = parseId(userId, 'شناسه کاربر');

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      lastLoginAt: true,
      failedLoginCount: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const [subscription, payments, auditLogs] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId: id },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    }),
    prisma.payment.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { plan: true },
    }),
    prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return {
    user,
    subscription: subscription ? toPublicSubscription(subscription) : null,
    recentPayments: payments.map(toPublicPayment),
    recentAuditLogs: auditLogs,
  };
}

export async function updateUser(userId, data = {}) {
  const id = parseId(userId, 'شناسه کاربر');

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const updateData = {};

  if (data.fullName !== undefined) {
    updateData.fullName = data.fullName;
  }

  if (data.email !== undefined && data.email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email: data.email } });
    if (conflict) throw new AppError(409, 'CONFLICT', 'این ایمیل قبلا ثبت شده است');
    updateData.email = data.email;
  }

  if (data.phone !== undefined) {
    updateData.phoneEncrypted = data.phone ? encrypt(data.phone) : null;
  }

  if (data.role !== undefined) {
    updateData.role = data.role;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'هیچ فیلدی برای به‌روزرسانی ارسال نشده است');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Deactivating a user must invalidate their active sessions.
    if (data.isActive === false) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return user;
  });

  await safeLog({
    userId: id,
    action: 'ADMIN_USER_UPDATED',
    entity: 'User',
    entityId: id,
    details: { fields: Object.keys(updateData) },
  });

  return updated;
}

export async function listPayments(filters = {}) {
  const {
    page = 1,
    limit = 10,
    sortOrder = 'desc',
    sortBy = 'createdAt',
    status,
    userId,
    planId,
    from,
    to,
    minAmountToman,
    maxAmountToman,
  } = filters;

  const skip = (page - 1) * limit;
  const sortField = PAYMENT_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';

  const where = {};
  if (status) where.status = status;
  if (userId !== undefined) where.userId = Number(userId);
  if (planId !== undefined) where.planId = Number(planId);

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  if (minAmountToman !== undefined || maxAmountToman !== undefined) {
    where.amountToman = {};
    if (minAmountToman !== undefined) where.amountToman.gte = Number(minAmountToman);
    if (maxAmountToman !== undefined) where.amountToman.lte = Number(maxAmountToman);
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
      include: {
        plan: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments.map((payment) => ({
      ...toPublicPayment(payment),
      user: payment.user,
    })),
    meta: paginationMeta(page, limit, total),
  };
}

export async function getPaymentDetails(paymentId) {
  const id = parseId(paymentId, 'شناسه پرداخت');

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      plan: true,
      user: { select: { id: true, email: true, fullName: true } },
      subscription: true,
    },
  });

  if (!payment) throw new AppError(404, 'NOT_FOUND', 'پرداخت یافت نشد');

  return {
    ...toPublicPayment(payment),
    authority: payment.authority,
    user: payment.user,
    subscription: payment.subscription,
  };
}

export async function listAuditLogs({ page = 1, limit = 10, sortOrder = 'desc' } = {}) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  return { data: logs, meta: paginationMeta(page, limit, total) };
}

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createPlan(data = {}) {
  const name = String(data.name ?? '').trim();
  if (name.length < 2 || name.length > 120) {
    throw new AppError(400, 'VALIDATION_ERROR', 'نام پلن باید بین ۲ تا ۱۲۰ کاراکتر باشد');
  }

  const price = Number(data.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'قیمت پلن نامعتبر است');
  }

  const duration = Number(data.duration);
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'مدت پلن نامعتبر است');
  }

  const description =
    data.description === undefined || data.description === null
      ? null
      : String(data.description).trim();

  const plan = await prisma.plan.create({
    data: {
      name,
      description,
      price,
      duration,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });

  await safeLog({
    action: 'ADMIN_PLAN_CREATED',
    entity: 'Plan',
    entityId: plan.id,
    details: { name: plan.name, price: plan.price, duration: plan.duration },
  });

  return plan;
}

export async function updatePlan(planId, data = {}) {
  const id = parseId(planId, 'شناسه پلن');

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');

  const updateData = {};

  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (name.length < 2 || name.length > 120) {
      throw new AppError(400, 'VALIDATION_ERROR', 'نام پلن باید بین ۲ تا ۱۲۰ کاراکتر باشد');
    }
    updateData.name = name;
  }

  if (data.description !== undefined) {
    updateData.description =
      data.description === null ? null : String(data.description).trim();
  }

  if (data.price !== undefined) {
    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'قیمت پلن نامعتبر است');
    }
    updateData.price = price;
  }

  if (data.duration !== undefined) {
    const duration = Number(data.duration);
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'مدت پلن نامعتبر است');
    }
    updateData.duration = duration;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'هیچ فیلدی برای به‌روزرسانی ارسال نشده است');
  }

  const updated = await prisma.plan.update({ where: { id }, data: updateData });

  await safeLog({
    action: 'ADMIN_PLAN_UPDATED',
    entity: 'Plan',
    entityId: id,
    details: { fields: Object.keys(updateData) },
  });

  return updated;
}

export async function deletePlan(planId) {
  const id = parseId(planId, 'شناسه پلن');

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');

  // Soft delete: plans are referenced by historical payments and subscriptions,
  // so a hard delete would break those records. Deactivating hides the plan
  // from the public listing while preserving history.
  const updated = await prisma.plan.update({
    where: { id },
    data: { isActive: false },
  });

  await safeLog({
    action: 'ADMIN_PLAN_DELETED',
    entity: 'Plan',
    entityId: id,
    details: { softDeleted: true },
  });

  return updated;
}

export default {
  getStats,
  getRevenue,
  listUsers,
  getUserDetails,
  updateUser,
  listPayments,
  getPaymentDetails,
  listAuditLogs,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
};
