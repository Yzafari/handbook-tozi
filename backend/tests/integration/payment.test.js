import express from 'express';
import request from 'supertest';
import prisma from '../../src/config/database.js';
import { authenticate } from '../../src/middlewares/auth.middleware.js';
import { errorHandler } from '../../src/middlewares/errorHandler.middleware.js';
import * as zarinpal from '../../src/services/zarinpal.service.js';
import paymentRoutes from '../../src/routes/payment.routes.js';

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

jest.mock('../../src/middlewares/auth.middleware.js', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'USER',
    };
    next();
  }),
}));

jest.mock('../../src/services/zarinpal.service.js', () => ({
  requestPayment: jest.fn(),
  verifyPayment: jest.fn(),
}));

jest.mock('../../src/services/subscription.service.js', () => ({
  activateSubscription: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notification.service.js', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/email.service.js', () => ({
  sendPaymentSuccessEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/audit.service.js', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';
const AUTHORITY = 'A000000000000000000000000000000000';

const app = express();

// Match the production parser arrangement: the webhook stream must remain
// untouched until express.raw() in payment.routes.js processes it.
app.use((req, res, next) => {
  if (req.originalUrl.split('?')[0] === '/api/payment/webhook') {
    return next();
  }

  return express.json()(req, res, next);
});

app.use('/api/payment', paymentRoutes);
app.use(errorHandler);

beforeEach(() => {
  jest.clearAllMocks();

  prisma.payment.findFirst.mockResolvedValue(null);
  prisma.plan.findFirst.mockResolvedValue({
    id: PLAN_ID,
    name: 'Pro',
    priceToman: 250000,
    durationDays: 30,
    isActive: true,
  });

  prisma.payment.create.mockResolvedValue({
    id: PAYMENT_ID,
    userId: USER_ID,
    planId: PLAN_ID,
    amountToman: 250000,
    status: 'PENDING',
    description: 'Subscription: Pro',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  prisma.payment.updateMany.mockResolvedValue({ count: 1 });

  zarinpal.requestPayment.mockResolvedValue({
    authority: AUTHORITY,
    paymentUrl: `https://sandbox.zarinpal.com/pg/StartPay/${AUTHORITY}`,
  });
});

describe('Payment API integration', () => {
  test('POST /api/payment/request creates a payment using the database plan price', async () => {
    const response = await request(app)
      .post('/api/payment/request')
      .send({
        planId: PLAN_ID,
        idempotencyKey: 'integration-key-1234',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      paymentId: PAYMENT_ID,
      paymentUrl:
        `https://sandbox.zarinpal.com/pg/StartPay/${AUTHORITY}`,
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          planId: PLAN_ID,
          amountToman: 250000,
          status: 'PENDING',
        }),
      }),
    );

    expect(zarinpal.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountToman: 250000 }),
    );
  });

  test('rejects invalid plan IDs', async () => {
    const response = await request(app)
      .post('/api/payment/request')
      .send({ planId: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  test('GET /api/payment/:id returns only the authenticated owner payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: PAYMENT_ID,
      userId: USER_ID,
      planId: PLAN_ID,
      amountToman: 250000,
      status: 'PENDING',
      refId: null,
      cardPanMasked: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      verifiedAt: null,
      plan: { name: 'Pro' },
    });

    const response = await request(app)
      .get(`/api/payment/${PAYMENT_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment).toMatchObject({
      id: PAYMENT_ID,
      planId: PLAN_ID,
      planName: 'Pro',
      amountToman: 250000,
      status: 'PENDING',
    });

    expect(response.body.data.payment).not.toHaveProperty('authority');
    expect(response.body.data.payment).not.toHaveProperty('ip');
  });

  test('GET /api/payment/verify redirects unknown authorities without exposing details', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/payment/verify')
      .query({
        Authority: AUTHORITY,
        Status: 'OK',
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/payment/result?');
    expect(response.headers.location).toContain('status=failed');
    expect(response.headers.location).not.toContain(AUTHORITY);
  });

  test('POST /api/payment/webhook rejects invalid signatures', async () => {
    const response = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', '0'.repeat(64))
      .send({ authority: AUTHORITY });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
  });
});