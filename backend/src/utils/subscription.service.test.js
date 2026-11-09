import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  activateSubscription,
  expireDueSubscriptions,
  sendExpiryReminders,
  toPublicSubscription,
} from '../../src/services/subscription.service.js';
import prisma from '../../src/config/database.js';
import * as emailService from '../../src/services/email.service.js';
import * as notificationService from '../../src/services/notification.service.js';
import * as auditService from '../../src/services/audit.service.js';

vi.mock('../../src/config/database.js', () => ({
  default: {
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendExpiredEmail: vi.fn().mockResolvedValue(true),
  sendExpiryReminderEmail: vi.fn().mockResolvedValue(true),
  sendMail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logEvent: vi.fn().mockResolvedValue(true),
}));

describe('Subscription Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toPublicSubscription', () => {
    it('returns null if input is null', () => {
      expect(toPublicSubscription(null)).toBeNull();
    });

    it('calculates daysRemaining correctly', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const sub = {
        id: 'sub-1',
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: futureDate,
        plan: {
          id: 'plan-1',
          slug: 'pro',
          name: 'Pro',
          priceToman: 100000,
          durationDays: 30,
          features: ['Feature 1'],
          isActive: true,
          sortOrder: 1,
        },
      };

      const result = toPublicSubscription(sub);
      expect(result.id).toBe('sub-1');
      expect(result.daysRemaining).toBe(5);
      expect(result.plan.slug).toBe('pro');
    });
  });

  describe('activateSubscription (single source of truth rule)', () => {
    it('creates a new subscription if no active one exists', async () => {
      const mockPlan = {
        id: 'plan-uuid',
        name: 'Gold',
        durationDays: 30,
      };

      const fakeTx = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
        },
        subscription: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => ({
            id: 'new-sub-id',
            ...data,
            plan: mockPlan,
          })),
        },
      };

      const result = await activateSubscription(fakeTx, {
        userId: 'user-1',
        planId: 'plan-uuid',
        paymentId: 'payment-1',
      });

      expect(fakeTx.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
      });
      expect(fakeTx.subscription.create).toHaveBeenCalled();
      expect(result.id).toBe('new-sub-id');
      expect(result.paymentId).toBe('payment-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('extends existing active subscription if current endsAt is in the future', async () => {
      const mockPlan = {
        id: 'new-plan-uuid',
        name: 'Platinum',
        durationDays: 30,
      };

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const existingSub = {
        id: 'existing-sub-id',
        userId: 'user-1',
        status: 'ACTIVE',
        endsAt: futureDate,
      };

      const fakeTx = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
        },
        subscription: {
          findFirst: vi.fn().mockResolvedValue(existingSub),
          update: vi.fn().mockImplementation(({ data }) => ({
            id: existingSub.id,
            ...data,
            plan: mockPlan,
          })),
        },
      };

      const result = await activateSubscription(fakeTx, {
        userId: 'user-1',
        planId: 'new-plan-uuid',
        paymentId: 'payment-2',
      });

      expect(fakeTx.subscription.update).toHaveBeenCalled();
      const updateCallArgs = fakeTx.subscription.update.mock.calls[0][0];
      const newEndsAt = updateCallArgs.data.endsAt;
      const expectedTime = futureDate.getTime() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(newEndsAt.getTime() - expectedTime)).toBeLessThan(1000);
      expect(updateCallArgs.data.planId).toBe('new-plan-uuid');
    });
  });

  describe('expireDueSubscriptions', () => {
    it('marks expired active subscriptions as EXPIRED, sends notification and email', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const mockExpiredSub = {
        id: 'sub-expired-1',
        userId: 'user-1',
        planId: 'plan-1',
        endsAt: pastDate,
        plan: { name: 'Gold' },
        user: { email: 'user@example.com' },
      };

      prisma.subscription.findMany.mockResolvedValue([mockExpiredSub]);
      prisma.subscription.update.mockResolvedValue({ ...mockExpiredSub, status: 'EXPIRED' });

      const count = await expireDueSubscriptions();

      expect(count).toBe(1);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-expired-1' },
        data: { status: 'EXPIRED' },
      });
      expect(notificationService.createNotification).toHaveBeenCalled();
      expect(emailService.sendExpiredEmail).toHaveBeenCalledWith(mockExpiredSub.user);
      expect(auditService.logEvent).toHaveBeenCalled();
    });
  });

  describe('sendExpiryReminders', () => {
    it('sends reminder emails and notifications for subscriptions expiring soon', async () => {
      const mockSub = {
        id: 'sub-remind-1',
        userId: 'user-2',
        endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        plan: { name: 'Pro' },
        user: { email: 'pro@example.com' },
      };

      prisma.subscription.findMany.mockResolvedValue([mockSub]);
      prisma.subscription.update.mockResolvedValue({ ...mockSub, reminderSentAt: new Date() });

      const count = await sendExpiryReminders();

      expect(count).toBe(1);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-remind-1' },
        data: { reminderSentAt: expect.any(Date) },
      });
      expect(emailService.sendExpiryReminderEmail).toHaveBeenCalledWith(mockSub.user, mockSub);
      expect(notificationService.createNotification).toHaveBeenCalled();
    });
  });
});