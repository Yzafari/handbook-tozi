import prisma from '../config/database.js';
import { ROLES } from '../config/constants.js';
import { AppError } from '../utils/response.util.js';
import { logEvent } from './audit.service.js';
import { toPublicUser } from './auth.service.js';
import { toPublicPayment } from './payment.service.js';

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

function pagination(query = {}) {
  const page = Number(query.page ?? PAGE_DEFAULT);
  const limit = Number(query.limit ?? LIMIT_DEFAULT);

  if (!Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) {
    throw new AppError(400, 'VALIDATION_ERROR', 'پارامترهای صفحه‌بندی نامعتبر هستند.');
  }

  return { page, limit, skip: (page - 1) * limit };
}

function pageResult(items, total, page, limit) {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function notFound(message = 'رکورد موردنظر پیدا نشد.') {
  return new AppError(404, 'NOT_FOUND', message);
}

function conflict(message) {
  return new AppError(409, 'CONFLICT', message);
}

function publicUser(user) {
  return user ? toPublicUser(user) : null;
}

function publicPayment(payment) {
  if (!payment) return null;

  const result = toPublicPayment(payment);
  return result;
}

function subscriptionView(subscription, now = new Date()) {
  if (!subscription) return null;

  return {
    id: subscription.id,
    status: subscription.status,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    daysRemaining: Math.max(
      0,
      Math.ceil((subscription.endsAt.getTime() - now.getTime()) / 86400000),
    ),
    plan: subscription.plan,
  };
}

function userSearch(search) {
  if (!search) return undefined;

  return {
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ],
  };
}

function paymentSearch(search) {
  if (!search) return undefined;

  return {
    OR: [
      { id: { contains: search, mode: 'insensitive' } },
      { refId: { contains: search, mode: 'insensitive' } },
      { authority: { contains: search, mode: 'insensitive' } },
      {
        user: {
          is: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ],
  };
}

function auditRequest(actorId, action, entity, entityId, req, metadata) {
  return logEvent({
    userId: actorId,
    action,
    entity,
    entityId,
    req,
    metadata,
  });
}

export async function getStats() {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 86400000);

  const [
    totalUsers,
    activeUsers,
    newUsersLast30Days,
    activeSubscriptions,
    revenue,
    successfulPayments,
    pendingPayments,
    failedPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.subscription.count({
      where: { status: 'ACTIVE', endsAt: { gt: now } },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amountToman: true },
    }),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    newUsersLast30Days,
    activeSubscriptions,
    totalRevenueToman: revenue._sum.amountToman ?? 0,
    successfulPayments,
    pendingPayments,
    failedPayments,
  };
}

export async function getRevenueSeries(days = 30) {
  const count = Number(days);

  if (!Number.isInteger(count) || count < 7 || count > 365) {
    throw new AppError(400, 'VALIDATION_ERROR', 'days باید بین ۷ تا ۳۶۵ باشد.');
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - count + 1);

  // Tagged-template parameterization: never concatenate user input into SQL.
  const rows = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', "createdAt")::date AS "date",
      COALESCE(SUM("amountToman"), 0)::bigint AS "revenueToman",
      COUNT(*)::bigint AS "count"
    FROM "Payment"
    WHERE "status" = 'SUCCESS'
      AND "createdAt" >= ${start}
    GROUP BY DATE_TRUNC('day', "createdAt")::date
    ORDER BY "date" ASC
  `;

  const byDate = new Map(
    rows.map((row) => {
      const date = row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date).slice(0, 10);

      return [date, {
        revenueToman: Number(row.revenueToman),
        count: Number(row.count),
      }];
    }),
  );

  const result = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const entry = byDate.get(key);

    result.push({
      date: key,
      revenueToman: entry?.revenueToman ?? 0,
      count: entry?.count ?? 0,
    });
  }

  return result;
}

export async function listUsers(query = {}) {
  const { page, limit, skip } = pagination(query);
  const where = {
    ...userSearch(query.search),
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return pageResult(users.map(publicUser), total, page, limit);
}

export async function getUserDetail(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { endsAt: 'desc' },
        take: 1,
        include: { plan: true },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { plan: true },
      },
    },
  });

  if (!user) throw notFound('کاربر پیدا نشد.');

  return {
    user: publicUser(user),
    subscription: subscriptionView(user.subscriptions[0] ?? null),
    recentPayments: user.payments.map(publicPayment),
  };
}

export async function updateUser({ id, actor, body, req }) {
  if (id === actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'ویرایش حساب کاربری خودتان مجاز نیست.');
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('کاربر پیدا نشد.');

  if (actor.role === ROLES.ADMIN && target.role === ROLES.SUPER_ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'مدیر عادی اجازه ویرایش مدیر ارشد را ندارد.');
  }

  if (body.role !== undefined && actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'تغییر نقش فقط برای مدیر ارشد مجاز است.');
  }

  const data = {};
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.role !== undefined) data.role = body.role;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data });

      if (body.isActive === false) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'ADMIN_USER_UPDATED',
          entity: 'User',
          entityId: id,
          ip: req?.ip ?? null,
          userAgent: req?.get?.('user-agent') ?? null,
          metadata: {
            changes: data,
            targetRoleBefore: target.role,
          },
        },
      });

      return user;
    });

    return publicUser(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw error;
  }
}

export async function listPayments(query = {}) {
  const { page, limit, skip } = pagination(query);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...paymentSearch(query.search),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        plan: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return pageResult(
    payments.map((payment) => ({
      ...publicPayment(payment),
      user: payment.user,
    })),
    total,
    page,
    limit,
  );
}

export async function getPaymentDetail(id) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      plan: true,
    },
  });

  if (!payment) throw notFound('پرداخت پیدا نشد.');

  return {
    payment: publicPayment(payment),
    user: payment.user,
  };
}

export async function listAuditLogs(query = {}) {
  const { page, limit, skip } = pagination(query);
  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return pageResult(
    logs.map(({ user, ...log }) => ({
      ...log,
      userEmail: user?.email ?? null,
    })),
    total,
    page,
    limit,
  );
}

export async function listAllPlans() {
  return prisma.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}

function normalizePlanData(input) {
  const data = { ...input };

  if (data.features !== undefined && !Array.isArray(data.features)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'features باید آرایه باشد.');
  }

  if (data.features !== undefined &&
      !data.features.every((feature) => typeof feature === 'string')) {
    throw new AppError(400, 'VALIDATION_ERROR', 'تمام ویژگی‌ها باید متن باشند.');
  }

  return data;
}

async function assertUniqueSlug(slug, excludeId) {
  if (!slug) return;

  const existing = await prisma.plan.findUnique({ where: { slug } });
  if (existing && existing.id !== excludeId) {
    throw conflict('این شناسه پلن قبلاً ثبت شده است.');
  }
}

export async function createPlan({ body, actor, req }) {
  const data = normalizePlanData(body);
  await assertUniqueSlug(data.slug);

  const plan = await prisma.plan.create({ data });
  await auditRequest(actor.id, 'ADMIN_PLAN_CREATED', 'Plan', plan.id, req, {
    slug: plan.slug,
  });

  return plan;
}

export async function updatePlan({ id, body, actor, req }) {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw notFound('پلن پیدا نشد.');

  const data = normalizePlanData(body);
  await assertUniqueSlug(data.slug, id);

  const plan = await prisma.plan.update({ where: { id }, data });
  await auditRequest(actor.id, 'ADMIN_PLAN_UPDATED', 'Plan', plan.id, req, {
    changes: data,
  });

  return plan;
}

export async function deletePlan({ id, actor, req }) {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw notFound('پلن پیدا نشد.');

  const plan = await prisma.plan.update({
    where: { id },
    data: { isActive: false },
  });

  await auditRequest(actor.id, 'ADMIN_PLAN_DELETED', 'Plan', plan.id, req, {
    slug: plan.slug,
  });
}