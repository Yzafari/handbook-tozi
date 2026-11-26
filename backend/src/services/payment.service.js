import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import logger from '../utils/logger.util.js';
import { requestPayment, verifyPayment, getPaymentUrl } from './zarinpal.service.js';
import { activateSubscription } from './subscription.service.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { env } from '../config/env.js';

const DEFAULT_DURATION_DAYS = 30;
const TOMAN_TO_RIAL = 10;
const PENDING_PAYMENT_TTL_MINUTES = Number(process.env.PAYMENT_PENDING_TTL_MINUTES) || 30;

function getCallbackUrl() {
  return env.ZARINPAL_CALLBACK_URL;
}

function maskCardPan(cardPan) {
  if (!cardPan) return null;
  const digits = String(cardPan).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${digits.slice(0, 6)}******${digits.slice(-4)}`;
}

function toRial(amountToman) {
  return Math.round(Number(amountToman) * TOMAN_TO_RIAL);
}

// The only unique column written by the create below is `idempotencyKey`, so a
// P2002 on that insert is an idempotency conflict. Prisma reports the target
// column differently across versions/engines, so fall back to "true" only when
// the target is not reported at all.
function isIdempotencyConflict(error) {
  if (error?.code !== 'P2002') return false;
  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes('idempotencyKey');
  if (typeof target === 'string') return target === 'idempotencyKey';
  return true;
}

export function toPublicPayment(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    planId: payment.planId,
    planName: payment.plan?.name ?? null,
    amountToman: payment.amountToman,
    status: payment.status,
    refId: payment.refId ?? null,
    cardPanMasked: payment.cardPanMasked ?? null,
    createdAt: payment.createdAt,
    verifiedAt: payment.verifiedAt ?? null,
  };
}

/**
 * Create a PENDING payment and open a Zarinpal session for it.
 *
 * Idempotency is enforced by the unique `idempotencyKey` column. Two concurrent
 * requests with the same key race on the INSERT; the loser receives P2002 and
 * is resolved below without ever creating a second gateway session.
 *
 * @param {string} userId
 * @param {{ planId: string, idempotencyKey?: string }} payload
 * @param {import('express').Request} [req]
 * @returns {Promise<{ payment: object, paymentUrl: string, authority: string, reused?: boolean }>}
 */
export async function createPaymentRequest(userId, payload = {}, req) {
  const planId = String(payload.planId ?? '').trim();
  const idempotencyKey = String(payload.idempotencyKey ?? req?.headers?.['idempotency-key'] ?? '').trim() || null;
  if (!planId || planId.length > 128) {
    throw new AppError(400, 'VALIDATION_ERROR', 'شناسه پلن نامعتبر است');
  }
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'کلید تکرارنشدن درخواست پرداخت معتبر نیست');
  }

  if (idempotencyKey) {
    const previous = await prisma.payment.findUnique({ where: { idempotencyKey }, include: { plan: true } });
    if (previous) {
      if (previous.userId !== userId) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'این کلید قبلاً برای حساب دیگری استفاده شده است');
      if (previous.status === 'PENDING' && previous.authority && Number.isSafeInteger(previous.amountToman) && previous.amountToman > 0) {
        return { payment: toPublicPayment(previous), paymentUrl: getPaymentUrl(previous.authority), authority: previous.authority, reused: true };
      }
      if (previous.status === 'PENDING') throw new AppError(409, 'PAYMENT_REQUEST_IN_PROGRESS', 'درخواست پرداخت با همین شناسه در حال پردازش است؛ چند لحظه دیگر دوباره تلاش کنید');
      throw new AppError(409, 'IDEMPOTENCY_KEY_ALREADY_USED', 'این کلید قبلاً برای یک درخواست پرداخت نهایی استفاده شده است؛ برای تلاش تازه، درخواست جدید ایجاد کنید');
    }
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.isActive === false) {
    throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');
  }

  const amountToman = Math.round(Number(plan.price));
  if (!Number.isFinite(amountToman) || amountToman <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'قیمت پلن نامعتبر است');
  }

  const requestedDays = Number(payload.durationDays);
  const durationDays =
    Number.isInteger(plan.durationDays) && plan.durationDays > 0
    ? plan.durationDays
    : DEFAULT_DURATION_DAYS;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amount: amountToman,
        amountToman,
        durationDays,
        idempotencyKey,
        status: 'PENDING',
      },
    });
  } catch (error) {
    if (idempotencyKey && isIdempotencyConflict(error)) {
      const previous = await prisma.payment.findUnique({ where: { idempotencyKey }, include: { plan: true } });
      if (previous?.userId === userId && previous.status === 'PENDING' && previous.authority) {
        return { payment: toPublicPayment(previous), paymentUrl: getPaymentUrl(previous.authority), authority: previous.authority, reused: true };
      }
      if (previous && previous.userId !== userId) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'این کلید قبلاً برای حساب دیگری استفاده شده است');
      throw new AppError(409, 'PAYMENT_REQUEST_IN_PROGRESS', 'درخواست پرداخت با همین شناسه در حال پردازش است؛ چند لحظه دیگر دوباره تلاش کنید');
    }
    throw error;
  }

  let gateway;
  try {
    gateway = await requestPayment({
      amount: toRial(amountToman),
      callbackUrl: getCallbackUrl(),
      description: `خرید ${plan.name}`,
      email: user.email,
    });
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    throw error;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { authority: gateway.authority },
    include: { plan: true },
  });

  try {
    await logEvent({
      userId,
      action: 'PAYMENT_CREATED',
      entity: 'Payment',
      entityId: payment.id,
      req,
    });
  } catch (error) {
    logger.error('Failed to log PAYMENT_CREATED event:', error?.message);
  }

  return {
    payment: toPublicPayment(updated),
    paymentUrl: gateway.paymentUrl,
    authority: gateway.authority,
  };
}

async function failPayment(payment, reason, req) {
  const result = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PENDING' },
    data: { status: 'FAILED' },
  });

  if (result.count === 0) return false;

  logger.warn(`Payment ${payment.id} marked as FAILED: ${reason}`);

  try {
    await logEvent({
      userId: payment.userId,
      action: 'PAYMENT_FAILED',
      entity: 'Payment',
      entityId: payment.id,
      req,
    });
  } catch (error) {
    logger.error('Failed to log PAYMENT_FAILED event:', error?.message);
  }

  return true;
}

async function finalizePayment(payment, verification, req) {
  const outcome = await prisma.$transaction(async (tx) => {
    // Atomic compare-and-set. The WHERE clause is the security boundary for
    // late callbacks: a FAILED row may only be promoted to SUCCESS when
    //   - the authority still matches the one we verified,
    //   - no verification has been recorded yet (verifiedAt IS NULL),
    //   - no subscription has been granted yet (subscriptionId IS NULL).
    // Only one concurrent callback/webhook can satisfy all three.
    const claimed = await tx.payment.updateMany({
      where: {
        id: payment.id,
        authority: payment.authority,
        status: { in: ['PENDING', 'FAILED'] },
        verifiedAt: null,
        subscriptionId: null,
      },
      data: {
        status: 'SUCCESS',
        refId: verification.refId,
        cardPanMasked: maskCardPan(verification.cardPan),
        verifiedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      const existing = await tx.payment.findUnique({
        where: { id: payment.id },
        include: { plan: true },
      });
      return { payment: existing, subscription: null, alreadyProcessed: true };
    }

    const subscription = await activateSubscription(tx, {
      userId: payment.userId,
      planId: payment.planId,
      durationDays: payment.durationDays,
    });

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
      include: { plan: true },
    });

    return { payment: updated, subscription, alreadyProcessed: false };
  });

  if (!outcome.alreadyProcessed) {
    try {
      await logEvent({
        userId: payment.userId,
        action: 'PAYMENT_SUCCESS',
        entity: 'Payment',
        entityId: payment.id,
        req,
      });
      await createNotification({
        userId: payment.userId,
        type: 'PAYMENT_SUCCESS',
        title: 'پرداخت موفق',
        body: `پرداخت شما با کد پیگیری ${verification.refId} با موفقیت انجام شد.`,
      });
    } catch (error) {
      logger.error('Post-payment side effects failed:', error?.message);
    }
  }

  return {
    payment: toPublicPayment(outcome.payment),
    subscriptionId: outcome.subscription?.id ?? outcome.payment?.subscriptionId ?? null,
    alreadyProcessed: outcome.alreadyProcessed,
  };
}

/**
 * Handle the browser redirect back from Zarinpal.
 *
 * @param {{ authority?: string, status?: string }} params
 * @param {import('express').Request} [req]
 */
export async function handleCallback(params = {}, req) {
  const authority = params.authority ?? params.Authority;
  const rawStatus = params.status ?? params.Status;
  const status = rawStatus === undefined || rawStatus === null ? undefined : String(rawStatus).toUpperCase();

  // Reject non-string authority values (e.g. ?authority=a&authority=b) before
  // they reach Prisma, which would otherwise throw a 500 on an array.
  if (typeof authority !== 'string' || !authority.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'authority الزامی است');
  }

  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: { plan: true },
  });

  if (!payment) throw new AppError(404, 'NOT_FOUND', 'پرداخت یافت نشد');

  // Idempotency: a repeated callback for a finalized payment is a no-op.
  if (payment.status === 'SUCCESS') {
    return {
      payment: toPublicPayment(payment),
      subscriptionId: payment.subscriptionId ?? null,
      alreadyProcessed: true,
    };
  }

  // A row that already has a subscription attached must never be promoted
  // again; that would grant a second subscription for a single charge.
  if (payment.subscriptionId) {
    throw new AppError(409, 'CONFLICT', 'این پرداخت قبلاً به اشتراک متصل شده است');
  }

  // A timeout or a lost callback may have marked the local row FAILED even
  // though the gateway completed the charge. A late OK callback is still
  // verified server-to-server and may safely finalize an unverified row.
  if (payment.status === 'FAILED' && status && status !== 'OK') {
    throw new AppError(409, 'CONFLICT', 'این پرداخت قبلا ناموفق ثبت شده است');
  }
  if (!Number.isSafeInteger(payment.amountToman) || payment.amountToman <= 0) {
    throw new AppError(409, 'LEGACY_AMOUNT_UNKNOWN', 'مبلغ تومانی این پرداخت قدیمی مشخص نیست و برای جلوگیری از تأیید مبلغ اشتباه، قابل تأیید خودکار نیست.');
  }

  if (status && status !== 'OK') {
    await failPayment(payment, `gateway status: ${status}`, req);
    throw new AppError(400, 'PAYMENT_CANCELLED', 'پرداخت توسط کاربر لغو شد');
  }

  let verification;
  try {
    verification = await verifyPayment({
      amount: toRial(payment.amountToman),
      authority,
    });
  } catch (error) {
    await failPayment(payment, 'verification failed', req);
    throw error;
  }

  return finalizePayment(payment, verification, req);
}

/**
 * Server-to-server notification endpoint. Zarinpal v4 has no true webhook, so this
 * accepts the same payload shape as the callback and reuses the idempotent path.
 * Never throws: always resolves so the gateway receives a 200.
 */
export async function handleWebhook(payload = {}, req) {
  try {
    const result = await handleCallback(
      {
        authority: payload.authority || payload.Authority,
        status: payload.status || payload.Status || 'OK',
      },
      req
    );
    return { ok: true, ...result };
  } catch (error) {
    logger.error('Payment webhook failed:', error?.message);
    return { ok: false, reason: error?.message ?? 'unknown error' };
  }
}

export async function getPaymentStatusByAuthority(authority) {
  if (!authority || typeof authority !== 'string') return null;
  return prisma.payment.findUnique({ where: { authority }, select: { id: true, status: true } });
}

export async function getPaymentForUser(userId, paymentId) {
  const id = String(paymentId ?? '').trim();
  if (!id || id.length > 128) {
    throw new AppError(400, 'VALIDATION_ERROR', 'شناسه پرداخت نامعتبر است');
  }

  const payment = await prisma.payment.findFirst({
    where: { id, userId },
    include: { plan: true },
  });

  if (!payment) throw new AppError(404, 'NOT_FOUND', 'پرداخت یافت نشد');

  return toPublicPayment(payment);
}

/**
 * Mark stale PENDING payments as FAILED. Invoked by the 5-minute cron job.
 *
 * @returns {Promise<number>} number of payments expired
 */
export async function expirePendingPayments() {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MINUTES * 60 * 1000);

  const result = await prisma.payment.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'FAILED' },
  });

  if (result.count > 0) {
    logger.info(`Expired ${result.count} pending payment(s).`);
  }

  return result.count;
}

export default {
  createPaymentRequest,
  handleCallback,
  handleWebhook,
  getPaymentForUser,
  getPaymentStatusByAuthority,
  toPublicPayment,
  expirePendingPayments,
};
