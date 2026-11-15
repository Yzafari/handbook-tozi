import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import { encrypt } from '../utils/hash.util.js';
import { logEvent } from './audit.service.js';
import { toPublicPayment } from './payment.service.js';
import { toPublicSubscription } from './subscription.service.js';
import { deleteCachedJson } from './cache/redis-cache.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_SORT_FIELDS = new Set(['createdAt', 'amountToman', 'status']);
const USER_SORT_FIELDS = new Set(['createdAt', 'name', 'email']);
const safePage = (v, fallback) => Math.max(1, Number.isInteger(Number(v)) ? Number(v) : fallback);
const safeLimit = (v, fallback) => Math.min(100, safePage(v, fallback));
const paginationMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const ensureId = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} نامعتبر است`);
  }
  return value.trim();
};
async function safeLog(payload) {
  try { await logEvent(payload); } catch { /* audit failure must not break the business operation */ }
}

export async function getStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const [totalUsers, activeUsers, newUsersLast30Days, totalPayments, successfulPayments,
    pendingPayments, failedPayments, legacyAmountUnknownCount, revenueAgg, revenueLast30Agg, activeSubscriptions,
    totalPlans, activePlans] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: 'SUCCESS', amountToman: null } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amountToman: true } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: thirtyDaysAgo } }, _sum: { amountToman: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gt: now } } }),
    prisma.plan.count(),
    prisma.plan.count({ where: { isActive: true } }),
  ]);
  return {
    totalUsers, activeUsers, newUsersLast30Days, activeSubscriptions,
    totalRevenueToman: revenueAgg._sum.amountToman ?? 0,
    last30DaysRevenueToman: revenueLast30Agg._sum.amountToman ?? 0,
    successfulPayments, pendingPayments, failedPayments, legacyAmountUnknownCount,
    revenueAmountsIncomplete: legacyAmountUnknownCount > 0,
    users: { total: totalUsers, active: activeUsers, newLast30Days: newUsersLast30Days },
    payments: { total: totalPayments, completed: successfulPayments, pending: pendingPayments, failed: failedPayments, legacyAmountUnknown: legacyAmountUnknownCount },
    revenue: { totalToman: revenueAgg._sum.amountToman ?? 0, last30DaysToman: revenueLast30Agg._sum.amountToman ?? 0 },
    subscriptions: { active: activeSubscriptions }, plans: { total: totalPlans, active: activePlans },
  };
}

export async function getRevenueSeries(filters = {}) {
  const days = Math.min(365, Math.max(1, Number.parseInt(filters.days, 10) || 30));
  const groupBy = ['day', 'week', 'month'].includes(filters.groupBy) ? filters.groupBy : 'day';
  const to = filters.to ? new Date(filters.to) : new Date();
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - days * DAY_MS);
  const planId = typeof filters.planId === 'string' && filters.planId ? filters.planId : null;
  const rows = await prisma.$queryRaw`
    SELECT date_trunc(${groupBy}, "createdAt") AS bucket,
           COALESCE(SUM("amountToman"), 0)::bigint AS revenue,
           COUNT("amountToman")::int AS count,
           COUNT(*) FILTER (WHERE "amountToman" IS NULL)::int AS unknown_amount_count
    FROM "Payment"
    WHERE "status" = 'SUCCESS' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND (${planId}::text IS NULL OR "planId" = ${planId})
    GROUP BY bucket ORDER BY bucket ASC`;
  return { range: { from, to, days, groupBy, planId }, items: rows.map(r => ({ date: r.bucket, revenueToman: Number(r.revenue), count: Number(r.count), unknownAmountCount: Number(r.unknown_amount_count) })) };
}

export async function listUsers(filters = {}) {
  const page = safePage(filters.page, 1); const limit = safeLimit(filters.limit, 10);
  const requestedSort = filters.sortBy === 'fullName' ? 'name' : filters.sortBy;
  const sortBy = USER_SORT_FIELDS.has(requestedSort) ? requestedSort : 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
  const where = {};
  if (filters.role) where.role = filters.role;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.search) where.OR = [
    { email: { contains: filters.search, mode: 'insensitive' } },
    { name: { contains: filters.search, mode: 'insensitive' } },
  ];
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit,
      select: { id: true, email: true, name: true, role: true, jobRole: true, province: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true } }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(u => ({ ...u, fullName: u.name })), meta: paginationMeta(page, limit, total) };
}

export async function getUserDetail(userId) {
  const id = ensureId(userId, 'شناسه کاربر');
  const user = await prisma.user.findUnique({ where: { id }, select: {
    id: true, email: true, name: true, role: true, jobRole: true, province: true, isActive: true, avatarUrl: true,
    lastLoginAt: true, failedLoginCount: true, lockedUntil: true, createdAt: true, updatedAt: true,
  } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');
  const [subscription, payments, logs] = await Promise.all([
    prisma.subscription.findFirst({ where: { userId: id }, orderBy: { endDate: 'desc' }, include: { plan: true } }),
    prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { plan: true } }),
    prisma.adminLog.findMany({ where: { adminId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return { user: { ...user, fullName: user.name }, subscription: subscription ? toPublicSubscription(subscription) : null,
    recentPayments: payments.map(toPublicPayment), recentAuditLogs: logs };
}

export async function updateUser({ id: userId, actor, body = {}, req } = {}) {
  const id = ensureId(userId, 'شناسه کاربر');
  if (actor?.id === id) throw new AppError(400, 'SELF_MODIFICATION_BLOCKED', 'مدیر نمی‌تواند حساب خودش را از این مسیر تغییر دهد');
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');
  if (existing.role === 'SUPER_ADMIN' && actor?.role !== 'SUPER_ADMIN') throw new AppError(403, 'FORBIDDEN', 'تغییر مدیر ارشد مجاز نیست');
  const data = {};
  if (body.fullName !== undefined) data.name = body.fullName;
  if (body.email !== undefined && body.email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email: body.email } });
    if (conflict) throw new AppError(409, 'CONFLICT', 'این ایمیل قبلا ثبت شده است');
    data.email = body.email;
  }
  if (body.phone !== undefined) data.phoneEncrypted = body.phone ? encrypt(body.phone) : null;
  if (body.jobRole !== undefined) data.jobRole = body.jobRole;
  if (body.province !== undefined) data.province = body.province;
  if (body.role !== undefined) {
    if (actor?.role !== 'SUPER_ADMIN' && body.role !== existing.role) throw new AppError(403, 'FORBIDDEN', 'تغییر نقش فقط برای مدیر ارشد مجاز است');
    data.role = body.role;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (!Object.keys(data).length) throw new AppError(400, 'VALIDATION_ERROR', 'هیچ فیلدی برای به‌روزرسانی ارسال نشده است');
  const securityChanged = (body.role !== undefined && body.role !== existing.role)
    || (body.isActive !== undefined && body.isActive !== existing.isActive)
    || (body.jobRole !== undefined && body.jobRole !== existing.jobRole);
  if (securityChanged) data.tokenVersion = { increment: 1 };
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, jobRole: true, province: true, isActive: true, avatarUrl: true, lastLoginAt: true, createdAt: true, updatedAt: true } });
    if (body.isActive === false || (body.role && body.role !== existing.role)) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return result;
  });
  await deleteCachedJson(`auth:user:${id}`);
  await safeLog({ userId: actor?.id, action: 'ADMIN_USER_UPDATED', entity: 'User', entityId: id, req, metadata: { fields: Object.keys(data) } });
  return { ...updated, fullName: updated.name };
}

export async function listPayments(filters = {}) {
  const page = safePage(filters.page, 1); const limit = safeLimit(filters.limit, 10);
  const sortBy = PAYMENT_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.search) where.OR = [
    { user: { email: { contains: filters.search, mode: 'insensitive' } } },
    { plan: { name: { contains: filters.search, mode: 'insensitive' } } },
  ];
  if (filters.userId) where.userId = String(filters.userId);
  if (filters.planId) where.planId = String(filters.planId);
  if (filters.from || filters.to) where.createdAt = { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) };
  if (filters.minAmountToman !== undefined || filters.maxAmountToman !== undefined) where.amountToman = { ...(filters.minAmountToman !== undefined ? { gte: Number(filters.minAmountToman) } : {}), ...(filters.maxAmountToman !== undefined ? { lte: Number(filters.maxAmountToman) } : {}) };
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit,
      include: { plan: true, user: { select: { id: true, email: true, name: true } } } }),
    prisma.payment.count({ where }),
  ]);
  return { items: payments.map(p => ({ ...toPublicPayment(p), user: { ...p.user, fullName: p.user.name } })), meta: paginationMeta(page, limit, total) };
}

export async function getPaymentDetail(paymentId) {
  const id = ensureId(paymentId, 'شناسه پرداخت');
  const payment = await prisma.payment.findUnique({ where: { id }, include: { plan: true, user: { select: { id: true, email: true, name: true } }, subscription: true } });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'پرداخت یافت نشد');
  return { ...toPublicPayment(payment), authority: payment.authority, user: { ...payment.user, fullName: payment.user.name }, subscription: payment.subscription };
}

export async function listAuditLogs(filters = {}) {
  const page = safePage(filters.page, 1); const limit = safeLimit(filters.limit, 10);
  const adminId = filters.adminId ?? filters.userId;
  const where = { ...(adminId ? { adminId: String(adminId) } : {}), ...(filters.action ? { action: filters.action } : {}) };
  const [items, total] = await Promise.all([
    prisma.adminLog.findMany({ where, orderBy: { createdAt: filters.sortOrder === 'asc' ? 'asc' : 'desc' }, skip: (page - 1) * limit, take: limit, include: { admin: { select: { id: true, email: true, name: true } } } }),
    prisma.adminLog.count({ where }),
  ]);
  const normalizedItems = items.map(log => {
    let details = {};
    try { details = log.details ? JSON.parse(log.details) : {}; } catch { details = { rawDetails: log.details }; }
    return { ...log, userId: log.adminId, userEmail: log.admin?.email ?? null, entity: details.entity ?? null, entityId: details.entityId ?? null, ip: details.ip ?? null, userAgent: details.userAgent ?? null, metadata: details.metadata ?? null };
  });
  return { items: normalizedItems, meta: paginationMeta(page, limit, total) };
}

export async function listAllPlans() { return prisma.plan.findMany({ orderBy: { createdAt: 'desc' } }); }
export const listPlans = listAllPlans;

export async function createPlan({ body = {}, actor, req } = {}) {
  const name = String(body.name ?? '').trim();
  const price = Number(body.price); const durationDays = Number(body.durationDays ?? body.duration);
  if (name.length < 2 || name.length > 120 || !Number.isSafeInteger(price) || price < 0 || !Number.isInteger(durationDays) || durationDays < 1) throw new AppError(400, 'VALIDATION_ERROR', 'اطلاعات پلن معتبر نیست');
  const plan = await prisma.plan.create({ data: { name, description: body.description?.trim() || null, price, durationDays, isActive: body.isActive ?? true } });
  await safeLog({ userId: actor?.id, action: 'ADMIN_PLAN_CREATED', entity: 'Plan', entityId: plan.id, req });
  return plan;
}

export async function updatePlan({ id: planId, body = {}, actor, req } = {}) {
  const id = ensureId(planId, 'شناسه پلن');
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.price !== undefined) data.price = Number(body.price);
  if (body.durationDays !== undefined || body.duration !== undefined) data.durationDays = Number(body.durationDays ?? body.duration);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (!Object.keys(data).length) throw new AppError(400, 'VALIDATION_ERROR', 'هیچ فیلدی برای به‌روزرسانی ارسال نشده است');
  if (data.name !== undefined && (data.name.length < 2 || data.name.length > 120)) throw new AppError(400, 'VALIDATION_ERROR', 'نام پلن نامعتبر است');
  if (data.price !== undefined && (!Number.isSafeInteger(data.price) || data.price < 0)) throw new AppError(400, 'VALIDATION_ERROR', 'قیمت پلن نامعتبر است');
  if (data.durationDays !== undefined && (!Number.isInteger(data.durationDays) || data.durationDays < 1)) throw new AppError(400, 'VALIDATION_ERROR', 'مدت پلن نامعتبر است');
  const plan = await prisma.plan.update({ where: { id }, data });
  await safeLog({ userId: actor?.id, action: 'ADMIN_PLAN_UPDATED', entity: 'Plan', entityId: id, req, metadata: { fields: Object.keys(data) } });
  return plan;
}

export async function deletePlan({ id: planId, actor, req } = {}) {
  const id = ensureId(planId, 'شناسه پلن');
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');
  const plan = await prisma.plan.update({ where: { id }, data: { isActive: false } });
  await safeLog({ userId: actor?.id, action: 'ADMIN_PLAN_DEACTIVATED', entity: 'Plan', entityId: id, req });
  return plan;
}
