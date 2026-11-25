import test from 'node:test';
import assert from 'node:assert/strict';

// The service imports the Prisma client at module load, which needs a datasource
// URL even though these tests never open a connection.
process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/db';
process.env.NODE_ENV = 'test';

const { sendExpiryReminders, activateSubscription } = await import('../src/services/subscription.service.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-25T10:00:00.000Z');

function subscription(overrides = {}) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-1',
    status: 'ACTIVE',
    endDate: new Date(NOW.getTime() + 2 * DAY_MS),
    expiryReminderSentAt: null,
    user: { email: 'first@example.com', name: 'کاربر' },
    plan: { id: 'plan-1', name: 'حرفه‌ای' },
    ...overrides,
  };
}

function createDb({ subscriptions = [], activeSubscription = null } = {}) {
  const calls = [];
  const subs = subscriptions.map(item => ({ ...item }));

  return {
    calls,
    subs,
    plan: {
      async findUnique(args) {
        calls.push({ model: 'plan', method: 'findUnique', args });
        return { id: 'plan-1', name: 'حرفه‌ای' };
      },
    },
    subscription: {
      async findMany(args) {
        calls.push({ model: 'subscription', method: 'findMany', args });
        return subs.filter(item => item.expiryReminderSentAt == null);
      },
      async updateMany(args) {
        calls.push({ model: 'subscription', method: 'updateMany', args });
        const target = subs.find(item => item.id === args.where.id && item.expiryReminderSentAt == null);
        if (!target) return { count: 0 };
        target.expiryReminderSentAt = args.data.expiryReminderSentAt;
        return { count: 1 };
      },
      async findFirst(args) {
        calls.push({ model: 'subscription', method: 'findFirst', args });
        return activeSubscription;
      },
      async update(args) {
        calls.push({ model: 'subscription', method: 'update', args });
        return { id: args.where.id, ...args.data };
      },
      async create(args) {
        calls.push({ model: 'subscription', method: 'create', args });
        return { id: 'sub-new', ...args.data };
      },
    },
  };
}

function recorder({ failFor = null } = {}) {
  const notifications = [];
  const emails = [];
  return {
    notifications,
    emails,
    notify: async payload => {
      notifications.push(payload);
      return { id: `notification-${notifications.length}` };
    },
    sendEmail: async user => {
      if (failFor && user.email === failFor) throw new Error('smtp unavailable');
      emails.push(user.email);
      return true;
    },
  };
}

test('an expiring subscription is reminded once even though the hourly job keeps running', async () => {
  const db = createDb({ subscriptions: [subscription()] });
  const sent = recorder();

  const first = await sendExpiryReminders({ now: NOW, db, notify: sent.notify, sendEmail: sent.sendEmail });
  const second = await sendExpiryReminders({
    now: new Date(NOW.getTime() + 60 * 60 * 1000),
    db,
    notify: sent.notify,
    sendEmail: sent.sendEmail,
  });

  assert.equal(first, 1);
  assert.equal(second, 0, 'the next hourly run must not remind the same subscription again');
  assert.equal(sent.notifications.length, 1);
  assert.deepEqual(sent.emails, ['first@example.com']);
  assert.equal(db.subs[0].expiryReminderSentAt, NOW);
});

test('the reminder query only targets unreminded subscriptions inside the reminder window', async () => {
  const db = createDb();
  const sent = recorder();

  await sendExpiryReminders({ now: NOW, db, notify: sent.notify, sendEmail: sent.sendEmail });

  const query = db.calls.find(call => call.method === 'findMany').args;
  assert.equal(query.where.status, 'ACTIVE');
  assert.equal(query.where.expiryReminderSentAt, null);
  assert.equal(query.where.endDate.gt.getTime(), NOW.getTime());
  assert.ok(query.where.endDate.lte.getTime() > NOW.getTime(), 'window ends after now');
  assert.deepEqual(query.include, { user: true, plan: true });
});

test('a reminder already claimed by another worker is not sent again', async () => {
  const db = createDb({ subscriptions: [subscription()] });
  const sent = recorder();
  db.subscription.updateMany = async args => {
    db.calls.push({ model: 'subscription', method: 'updateMany', args });
    return { count: 0 }; // another instance claimed it first
  };

  const processed = await sendExpiryReminders({ now: NOW, db, notify: sent.notify, sendEmail: sent.sendEmail });

  assert.equal(processed, 0);
  assert.equal(sent.notifications.length, 0);
  assert.deepEqual(sent.emails, []);
});

test('a failing reminder email neither aborts the batch nor causes a resend', async () => {
  const db = createDb({
    subscriptions: [
      subscription(),
      subscription({ id: 'sub-2', userId: 'user-2', user: { email: 'second@example.com', name: 'کاربر دوم' } }),
    ],
  });
  const sent = recorder({ failFor: 'first@example.com' });

  const processed = await sendExpiryReminders({ now: NOW, db, notify: sent.notify, sendEmail: sent.sendEmail });

  assert.equal(processed, 2);
  assert.equal(sent.notifications.length, 2);
  assert.deepEqual(sent.emails, ['second@example.com']);
  assert.ok(db.subs.every(item => item.expiryReminderSentAt instanceof Date), 'both reminders are claimed');
});

test('extending an active subscription clears expiryReminderSentAt for the next cycle', async () => {
  const db = createDb({
    activeSubscription: {
      id: 'sub-1',
      status: 'ACTIVE',
      endDate: NOW,
      expiryReminderSentAt: new Date(NOW.getTime() - DAY_MS),
    },
  });

  await activateSubscription(db, { userId: 'user-1', planId: 'plan-1', durationDays: 30 });

  const update = db.calls.find(call => call.method === 'update');
  assert.ok(update, 'the existing subscription is extended, not recreated');
  assert.equal(update.args.data.expiryReminderSentAt, null);
  assert.ok(update.args.data.endDate.getTime() > NOW.getTime());
});
