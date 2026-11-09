import crypto from 'node:crypto';
import prisma from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { activateSubscription } from '../../src/services/subscription.service.js';
import { createNotification } from '../../src/services/notification.service.js';
import { sendPaymentSuccessEmail } from '../../src/services/email.service.js';
import * as zarinpal from '../../src/services/zarinpal.service.js';
import {
  createPaymentRequest,
  handleCallback,
  handleWebhook,
  getPaymentForUser,
  expirePendingPayments,
} from '../../src/services/payment.service.js';

jest.mock('../../src/config/database.js', () => ({
  __esModule: true,
  default: {
    plan: { findFirst: jest.fn() },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/zarinpal.service.js', () => ({
  requestPayment: jest.fn(),
  verifyPayment: jest.fn(),
}));

jest.mock('../../src/services/subscription.service.js', () => ({
  activateSubscription: jest.fn(),
}));

jest.mock('../../src/services/notification.service.js', () => ({
  createNotification: jest.fn(),
}));

jest.mock('../../src/services/email.service.js', () => ({
  sendPaymentSuccessEmail: jest.fn(),
}));

jest.mock('../../src/services/audit.service.js', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';
const AUTHORITY = 'A000000000000000000000000000000000';

const plan = {
  id: PLAN_ID,
  name: 'Pro',
  priceToman: 250000,
  durationDays: 30,
  isActive: true,
};

function makePayment(overrides = {}) {
  return {
    id: PAYMENT_ID,
    userId: USER_ID,
    planId: PLAN_ID,
    amountToman: 250000,
    status: 'PENDING',
    authority: AUTHORITY,
    refId: null,
    cardPanMasked: null,
    description: 'Subscription: Pro',
    idempotencyKey: null,
    failureReason: null,
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    createdAt: new Date(),
    plan,
    user: {
      id: USER_ID,
      email: 'customer@example.test',
      fullName: 'Test User',
    },
    ...overrides,
  };
}

const tx = {
  payment: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();

  env.ZARINPAL_SANDBOX = true;
  env.PAYMENT_WEBHOOK_SECRET = 'unit-test-webhook-secret';

  prisma.$transaction.mockImplementation((callback) => callback(tx));

  prisma.user.findUnique.mockResolvedValue({
    id: USER_ID,
    email: 'customer@example.test',
    fullName: 'Test User',
  });

  createNotification.mockResolvedValue(undefined);
  sendPaymentSuccessEmail.mockResolvedValue(undefined);
  activateSubscription.mockResolvedValue(undefined);
});

describe('payment service', () => {
  test('uses the active plan price from the database, never a client amount', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue(plan);
    prisma.payment.create.mockResolvedValue(makePayment());
    zarinpal.requestPayment.mockResolvedValue({
      authority: AUTHORITY,
      paymentUrl: `https://sandbox.zarinpal.com/pg/StartPay/${AUTHORITY}`,
    });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    const result = await createPaymentRequest(
      USER_ID,
      { planId: PLAN_ID },
      { ip: '127.0.0.1' },
    );

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          planId: PLAN_ID,
          amountToman: 250000,
          status: 'PENDING',
          expiresAt: expect.any(Date),
        }),
      }),
    );

    expect(zarinpal.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountToman: 250000 }),
    );

    expect(result.paymentId).toBe(PAYMENT_ID);
  });

  test('returns an existing pending payment for the same user and idempotency key', async () => {
    prisma.payment.findFirst.mockResolvedValue(
      makePayment({ idempotencyKey: 'idem-key-12345678' }),
    );

    const result = await createPaymentRequest(
      USER_ID,
      { planId: PLAN_ID, idempotencyKey: 'idem-key-12345678' },
      {},
    );

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
      paymentUrl:
        `https://sandbox.zarinpal.com/pg/StartPay/${AUTHORITY}`,
    });

    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(zarinpal.requestPayment).not.toHaveBeenCalled();
  });

  test('activates a subscription only once for duplicate callbacks', async () => {
    let current = makePayment();

    prisma.payment.findUnique.mockImplementation(async () => current);

    zarinpal.verifyPayment.mockResolvedValue({
      code: 100,
      refId: '123456',
      cardPan: '603799******1234',
    });

    tx.payment.updateMany.mockImplementation(async ({ data }) => {
      if (current.status !== 'PENDING') return { count: 0 };

      current = { ...current, ...data };
      return { count: 1 };
    });

    tx.payment.findUnique.mockImplementation(async () => current);

    const first = await handleCallback(
      { authority: AUTHORITY, status: 'OK' },
      {},
    );

    const second = await handleCallback(
      { authority: AUTHORITY, status: 'OK' },
      {},
    );

    expect(first).toEqual({
      paymentId: PAYMENT_ID,
      outcome: 'success',
    });
    expect(second).toEqual({
      paymentId: PAYMENT_ID,
      outcome: 'success',
    });

    expect(activateSubscription).toHaveBeenCalledTimes(1);
    expect(zarinpal.verifyPayment).toHaveBeenCalledTimes(1);
    expect(current.cardPanMasked).toBe('************1234');
  });

  test('rejects an expired payment without verifying or activating it', async () => {
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const result = await handleCallback(
      { authority: AUTHORITY, status: 'OK' },
      {},
    );

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
      outcome: 'failed',
    });

    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PAYMENT_ID,
          status: 'PENDING',
        }),
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    );
  });

  test('rejects a webhook with an invalid HMAC before processing it', async () => {
    const body = Buffer.from(JSON.stringify({ authority: AUTHORITY }));
    const badSignature = '0'.repeat(64);

    await expect(
      handleWebhook(body, badSignature),
    ).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
    expect(activateSubscription).not.toHaveBeenCalled();
  });

  test('rejects a callback for an unknown authority without revealing details', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(
      handleCallback({ authority: 'UNKNOWN', status: 'OK' }, {}),
    ).resolves.toEqual({
      paymentId: null,
      outcome: 'failed',
    });

    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
  });

  test('returns 404 for a payment owned by another user', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      getPaymentForUser(USER_ID, PAYMENT_ID),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  test('expires overdue pending payments using a conditional update', async () => {
    prisma.payment.findMany.mockResolvedValue([
      makePayment({ expiresAt: new Date(Date.now() - 60_000) }),
    ]);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await expect(expirePendingPayments()).resolves.toBe(1);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PAYMENT_ID,
          status: 'PENDING',
          expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: 'EXPIRED',
          failureReason: 'PAYMENT_EXPIRED',
        }),
      }),
    );
  });

  test('validates webhook signatures with HMAC-SHA256 over exact raw bytes', async () => {
    const body = Buffer.from(JSON.stringify({ authority: AUTHORITY }));
    const signature = crypto
      .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(handleWebhook(body, signature)).resolves.toEqual({
      status: 'failed',
    });
  });
});