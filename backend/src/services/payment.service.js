import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';
import logger from '../utils/logger.util.js';
import { requestPayment, verifyPayment } from './zarinpal.service.js';
import { activateSubscription } from './subscription.service.js';
import { logEvent } from './audit.service.js';
import { createNotification } from './notification.service.js';

const DEFAULT_DURATION_DAYS = 30;
const TOMAN_TO_RIAL = 10;
const PENDING_PAYMENT_TTL_MINUTES = Number(process.env.PAYMENT_PENDING_TTL_MINUTES) || 30;

function getCallbackUrl() {
  const base =
    process.env.PAYMENT_CALLBACK_BASE_URL ||
    process.env.APP_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  return `${base.replace(/\/+$/, '')}/api/payments/verify`;
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
 * @param {number} userId
 * @param {{ planId: number, durationDays?: number }} payload
 * @param {import('express').Request} [req]
 * @returns {Promise<{ payment: object, paymentUrl: string, authority: string }>}
 */
export async function createPaymentRequest(userId, payload = {}, req) {
  const planId = Number(payload.planId);
  if (!Number.isInteger(planId) || planId <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'شناسه پلن نامعتبر است');
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
    Number.isInteger(requestedDays) && requestedDays > 0
      ? requestedDays
      : Number(plan.duration) > 0
        ? Number(plan.duration)
        : DEFAULT_DURATION_DAYS;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'کاربر یافت نشد');

  const payment = await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      amountToman,
      durationDays,
      status: 'PENDING',
    },
  });

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
    // Atomic compare-and-set: only the first caller can move PENDING -> COMPLETED.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
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
        action: 'PAYMENT_COMPLETED',
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
  const authority = params.authority || params.Authority;
  const status = params.status || params.Status;

  if (!authority) {
    throw new AppError(400, 'VALIDATION_ERROR', 'authority الزامی است');
  }

  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: { plan: true },
  });

  if (!payment) throw new AppError(404, 'NOT_FOUND', 'پرداخت یافت نشد');

  // Idempotency: a repeated callback for a finalized payment is a no-op.
  if (payment.status === 'COMPLETED') {
    return {
      payment: toPublicPayment(payment),
      subscriptionId: payment.subscriptionId ?? null,
      alreadyProcessed: true,
    };
  }

  if (payment.status === 'FAILED') {
    throw new AppError(409, 'CONFLICT', 'این پرداخت قبلا ناموفق ثبت شده است');
  }

  if (status && String(status).toUpperCase() !== 'OK') {
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

export async function getPaymentForUser(userId, paymentId) {
  const id = Number(paymentId);
  if (!Number.isInteger(id) || id <= 0) {
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
  toPublicPayment,
  expirePendingPayments,
};
