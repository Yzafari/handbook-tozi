import crypto from 'node:crypto';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.util.js';
import { PAYMENT, AUDIT_ACTIONS } from '../config/constants.js';
import { activateSubscription } from './subscription.service.js';
import { createNotification } from './notification.service.js';
import { sendPaymentSuccessEmail } from './email.service.js';
import { logEvent } from './audit.service.js';
import * as zarinpal from './zarinpal.service.js';

const EXPIRY_MINUTES = PAYMENT?.PENDING_TTL_MINUTES ?? 30;

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Payment not found.');
}

function paymentError(message, details) {
  return new AppError(502, 'PAYMENT_ERROR', message, details);
}

function maskCardPan(cardPan) {
  if (typeof cardPan !== 'string') return null;

  const digits = cardPan.replace(/\D/g, '');
  if (digits.length < 4) return null;

  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function publicOutcome(status) {
  return status === 'SUCCESS' ? 'success' : 'failed';
}

function safeMetadata(payment) {
  return {
    paymentId: payment.id,
    planId: payment.planId,
    amountToman: payment.amountToman,
    status: payment.status,
  };
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

async function audit({ userId, action, payment, req, metadata = {} }) {
  try {
    await logEvent({
      userId,
      action,
      entity: 'Payment',
      entityId: payment?.id,
      req,
      metadata: {
        ...safeMetadata(payment ?? {}),
        ...metadata,
      },
    });
  } catch {
    // The shared audit service is specified as non-throwing. Do not
    // compromise payment processing if a custom implementation throws.
  }
}

async function notifyPaymentResult(payment, success) {
  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { id: true, email: true, fullName: true },
  });

  if (!user) return;

  try {
    await createNotification({
      userId: user.id,
      type: success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
      title: success ? 'پرداخت موفق' : 'پرداخت ناموفق',
      body: success
        ? `پرداخت ${payment.amountToman} تومان با موفقیت تأیید شد.`
        : 'پرداخت تأیید نشد. در صورت کسر وجه، نتیجه را از درگاه پیگیری کنید.',
    });
  } catch {
    // Notification delivery must not roll back a verified payment.
  }

  if (success && user.email) {
    try {
      await sendPaymentSuccessEmail({
        to: user.email,
        fullName: user.fullName,
        payment: toPublicPayment(payment),
      });
    } catch {
      // Email delivery must not roll back a verified payment.
    }
  }
}

export async function createPaymentRequest(
  userId,
  { planId, idempotencyKey },
  req,
) {
  if (idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: {
        userId,
        idempotencyKey,
      },
      include: { plan: true },
    });

    if (existing) {
      if (
        existing.status === 'PENDING' &&
        existing.expiresAt > new Date() &&
        existing.authority
      ) {
        const sandbox = Boolean(env.ZARINPAL_SANDBOX);
        const host = sandbox
          ? 'https://sandbox.zarinpal.com'
          : 'https://payment.zarinpal.com';

        return {
          paymentId: existing.id,
          paymentUrl: `${host}/pg/StartPay/${encodeURIComponent(existing.authority)}`,
        };
      }

      throw new AppError(
        409,
        'CONFLICT',
        'This idempotency key has already been used.',
      );
    }
  }

  const plan = await prisma.plan.findFirst({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Active plan not found.');
  }

  if (!Number.isSafeInteger(plan.priceToman) || plan.priceToman <= 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Plan price is invalid.');
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + EXPIRY_MINUTES * 60 * 1000,
  );

  let payment;

  try {
    payment = await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amountToman: plan.priceToman,
        status: 'PENDING',
        description: `Subscription: ${plan.name}`,
        idempotencyKey: idempotencyKey ?? null,
        ip: req?.ip ?? null,
        expiresAt,
      },
    });
  } catch (error) {
    // A concurrent request may win the unique idempotency key race.
    if (idempotencyKey) {
      const existing = await prisma.payment.findFirst({
        where: { userId, idempotencyKey },
      });

      if (
        existing?.status === 'PENDING' &&
        existing.expiresAt > new Date() &&
        existing.authority
      ) {
        const host = env.ZARINPAL_SANDBOX
          ? 'https://sandbox.zarinpal.com'
          : 'https://payment.zarinpal.com';

        return {
          paymentId: existing.id,
          paymentUrl: `${host}/pg/StartPay/${encodeURIComponent(existing.authority)}`,
        };
      }
    }

    throw error;
  }

  try {
    const callbackUrl = env.ZARINPAL_CALLBACK_URL;

    if (!callbackUrl) {
      throw paymentError('Payment callback URL is not configured.');
    }

    const gateway = await zarinpal.requestPayment({
      amountToman: payment.amountToman,
      description: payment.description,
      callbackUrl,
    });

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { authority: gateway.authority },
    });

    if (updated.count !== 1) {
      throw new AppError(
        409,
        'CONFLICT',
        'Payment request is no longer pending.',
      );
    }

    await audit({
      userId,
      action: AUDIT_ACTIONS.PAYMENT_REQUESTED,
      payment: { ...payment, authority: gateway.authority },
      req,
    });

    return {
      paymentId: payment.id,
      paymentUrl: gateway.paymentUrl,
    };
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: 'PAYMENT_REQUEST_FAILED',
      },
    });

    if (error instanceof AppError) throw error;

    throw paymentError('Could not create the payment request.');
  }
}

export async function handleCallback({ authority, status }, req) {
  if (!authority || !['OK', 'NOK'].includes(status)) {
    return { paymentId: null, outcome: 'failed' };
  }

  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: {
      plan: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  });

  // Never disclose whether an unknown authority exists.
  if (!payment) return { paymentId: null, outcome: 'failed' };

  if (payment.status === 'SUCCESS') {
    return { paymentId: payment.id, outcome: 'success' };
  }

  if (
    payment.status !== 'PENDING' ||
    payment.expiresAt <= new Date()
  ) {
    if (payment.status === 'PENDING') {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'EXPIRED',
          failureReason: 'PAYMENT_EXPIRED',
        },
      });
    }

    return { paymentId: payment.id, outcome: 'failed' };
  }

  if (status === 'NOK') {
    const changed = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: 'GATEWAY_CANCELLED',
      },
    });

    if (changed.count === 1) {
      await audit({
        userId: payment.userId,
        action: AUDIT_ACTIONS.PAYMENT_FAILED,
        payment: { ...payment, status: 'FAILED' },
        req,
      });
      await notifyPaymentResult(
        { ...payment, status: 'FAILED' },
        false,
      );
    }

    const current = await prisma.payment.findUnique({
      where: { id: payment.id },
    });

    return {
      paymentId: payment.id,
      outcome: publicOutcome(current?.status),
    };
  }

  let verification;

  try {
    verification = await zarinpal.verifyPayment({
      amountToman: payment.amountToman,
      authority: payment.authority,
    });
  } catch (error) {
    // A transient gateway failure is not proof that the customer failed
    // to pay. Keep the record pending so the callback can be retried.
    throw error instanceof AppError
      ? error
      : paymentError('Payment verification failed.');
  }

  if (verification.code !== 100 && verification.code !== 101) {
    const changed = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: `GATEWAY_VERIFY_${verification.code}`,
      },
    });

    if (changed.count === 1) {
      await audit({
        userId: payment.userId,
        action: AUDIT_ACTIONS.PAYMENT_FAILED,
        payment: { ...payment, status: 'FAILED' },
        req,
        metadata: { gatewayCode: verification.code },
      });
      await notifyPaymentResult(
        { ...payment, status: 'FAILED' },
        false,
      );
    }

    const current = await prisma.payment.findUnique({
      where: { id: payment.id },
    });

    return {
      paymentId: payment.id,
      outcome: publicOutcome(current?.status),
    };
  }

  let activated = false;
  let committedPayment = null;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      data: {
        status: 'SUCCESS',
        refId: verification.refId,
        cardPanMasked: maskCardPan(verification.cardPan),
        verifiedAt: new Date(),
        failureReason: null,
      },
    });

    if (claimed.count !== 1) {
      committedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      return;
    }

    // Only code 100 represents a fresh verification. Code 101 means
    // Zarinpal already verified this authority. It must never cause
    // another activation if this application did not commit success.
    if (verification.code !== 100) {
      throw new AppError(
        409,
        'CONFLICT',
        'Payment was already verified by the gateway but not finalized locally.',
      );
    }

    await activateSubscription(tx, {
      userId: payment.userId,
      planId: payment.planId,
      paymentId: payment.id,
    });

    committedPayment = await tx.payment.findUnique({
      where: { id: payment.id },
      include: { plan: true },
    });

    activated = true;
  });

  if (!activated) {
    const current = committedPayment
      ?? await prisma.payment.findUnique({
        where: { id: payment.id },
      });

    return {
      paymentId: payment.id,
      outcome: publicOutcome(current?.status),
    };
  }

  await audit({
    userId: payment.userId,
    action: AUDIT_ACTIONS.PAYMENT_SUCCESS,
    payment: committedPayment,
    req,
    metadata: { refId: verification.refId },
  });

  await notifyPaymentResult(committedPayment, true);

  return { paymentId: payment.id, outcome: 'success' };
}

export async function handleWebhook(rawBody, signatureHeader) {
  if (!env.PAYMENT_WEBHOOK_SECRET) {
    throw paymentError('Payment webhook is not configured.');
  }

  const body = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody ?? '');

  const supplied = typeof signatureHeader === 'string'
    ? signatureHeader.trim()
    : '';

  if (!/^[a-f0-9]{64}$/i.test(supplied)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid webhook signature.');
  }

  const expected = crypto
    .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
    .update(body)
    .digest();

  const provided = Buffer.from(supplied, 'hex');

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid webhook signature.');
  }

  let parsed;

  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid webhook JSON.');
  }

  const { authority } = parsed ?? {};

  if (typeof authority !== 'string' || !authority.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid webhook body.');
  }

  const result = await handleCallback(
    { authority: authority.trim(), status: 'OK' },
    undefined,
  );

  return { status: result.outcome };
}

export async function getPaymentForUser(userId, paymentId) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { plan: { select: { name: true } } },
  });

  if (!payment) throw notFound();

  return toPublicPayment(payment);
}

export async function expirePendingPayments() {
  const now = new Date();

  const expired = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      userId: true,
      planId: true,
      amountToman: true,
      status: true,
      expiresAt: true,
    },
  });

  let count = 0;

  for (const payment of expired) {
    const changed = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
        failureReason: 'PAYMENT_EXPIRED',
      },
    });

    if (changed.count !== 1) continue;

    count += 1;

    await audit({
      userId: payment.userId,
      action: AUDIT_ACTIONS.PAYMENT_EXPIRED,
      payment: { ...payment, status: 'EXPIRED' },
    });
  }

  return count;
}