import 'dotenv/config';
import prisma from '../src/config/database.js';
import { hashPassword } from '../src/utils/hash.util.js';

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD;

if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
  throw new Error(
    'SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required.',
  );
}

if (SUPER_ADMIN_PASSWORD.length < 8) {
  throw new Error('SEED_SUPER_ADMIN_PASSWORD must contain at least 8 characters.');
}

const plans = [
  {
    slug: 'starter',
    name: 'شروع',
    description: 'مناسب استفاده اولیه از امکانات GridHand',
    priceToman: 99000,
    durationDays: 30,
    sortOrder: 1,
    isActive: true,
    features: [
      'دسترسی به ماشین‌حساب‌های پایه برق',
      'مشاهده محتوای آموزشی عمومی',
      'ذخیره تاریخچه محاسبات',
      'جست‌وجوی تجهیزات شبکه',
    ],
  },
  {
    slug: 'pro',
    name: 'حرفه‌ای',
    description: 'برای کارشناسان و تکنسین‌های شبکه توزیع',
    priceToman: 249000,
    durationDays: 90,
    sortOrder: 2,
    isActive: true,
    features: [
      'دسترسی به محاسبات تخصصی شبکه',
      'ذخیره و اشتراک‌گذاری گزارش‌ها',
      'جست‌وجوی پیشرفته تجهیزات',
      'دسترسی به آموزش‌های تخصصی',
      'دسترسی به ابزارهای بهره‌برداری',
    ],
  },
  {
    slug: 'business',
    name: 'سازمانی',
    description: 'برای استفاده حرفه‌ای و بلندمدت',
    priceToman: 799000,
    durationDays: 365,
    sortOrder: 3,
    isActive: true,
    features: [
      'دسترسی به امکانات حرفه‌ای',
      'دسترسی سالانه به محاسبات تخصصی',
      'گزارش‌گیری و خروجی قابل اشتراک',
      'جست‌وجوی پیشرفته اطلاعات فنی',
      'دسترسی به مجموعه آموزش‌های تخصصی',
      'اولویت در دریافت پشتیبانی',
    ],
  },
];

async function upsertUser({ email, password, fullName, role, isActive = true }) {
  const passwordHash = await hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName,
      role,
      isActive,
      emailVerified: true,
    },
    create: {
      email,
      passwordHash,
      fullName,
      role,
      isActive,
      emailVerified: true,
    },
  });
}

async function main() {
  const superAdmin = await upsertUser({
    email: SUPER_ADMIN_EMAIL.trim().toLowerCase(),
    password: SUPER_ADMIN_PASSWORD,
    fullName: 'مدیر ارشد GridHand',
    role: 'SUPER_ADMIN',
  });

  const admin = await upsertUser({
    email: 'admin@gridhand.local',
    password: 'GridHandAdmin2026!',
    fullName: 'مدیر آزمایشی',
    role: 'ADMIN',
  });

  const demoUser = await upsertUser({
    email: 'user@gridhand.local',
    password: 'GridHandUser2026!',
    fullName: 'کاربر آزمایشی',
    role: 'USER',
  });

  const savedPlans = {};

  for (const plan of plans) {
    savedPlans[plan.slug] = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  const demoUsers = [demoUser, admin, superAdmin];
  const planList = [savedPlans.starter, savedPlans.pro, savedPlans.business];
  const now = new Date();

  // Stable idempotency keys make this seed safe to run repeatedly.
  const seededPayments = [];

  for (let i = 0; i < 40; i += 1) {
    const user = demoUsers[i % demoUsers.length];
    const plan = planList[i % planList.length];
    const ageDays = (i * 17 + 3) % 60;
    const createdAt = new Date(now.getTime() - ageDays * 86400000);
    const isSuccessful = i % 5 !== 1 && i % 7 !== 3;
    const status = isSuccessful ? 'SUCCESS' : 'FAILED';
    const expiresAt = new Date(createdAt.getTime() + 30 * 60000);
    const verifiedAt = isSuccessful
      ? new Date(createdAt.getTime() + 60000)
      : null;

    const payment = await prisma.payment.upsert({
      where: { idempotencyKey: `seed-demo-payment-${i + 1}` },
      update: {
        userId: user.id,
        planId: plan.id,
        amountToman: plan.priceToman,
        status,
        description: 'پرداخت آزمایشی Seed',
        expiresAt,
        verifiedAt,
        createdAt,
        failureReason: isSuccessful ? null : 'DEMO_PAYMENT_FAILED',
      },
      create: {
        userId: user.id,
        planId: plan.id,
        amountToman: plan.priceToman,
        status,
        description: 'پرداخت آزمایشی Seed',
        idempotencyKey: `seed-demo-payment-${i + 1}`,
        expiresAt,
        verifiedAt,
        createdAt,
        failureReason: isSuccessful ? null : 'DEMO_PAYMENT_FAILED',
      },
    });

    seededPayments.push({ payment, user, plan, isSuccessful, i });
  }

  // Keep one ACTIVE subscription per demo account.
  // Reuse a successful payment and its unique paymentId on subsequent runs.
  for (const target of [
    { user: demoUser, preferredIndex: 0 },
    { user: admin, preferredIndex: 2 },
  ]) {
    const selected = seededPayments.find(
      (entry) =>
        entry.user.id === target.user.id &&
        entry.isSuccessful &&
        entry.i === target.preferredIndex,
    ) ?? seededPayments.find(
      (entry) => entry.user.id === target.user.id && entry.isSuccessful,
    );

    if (!selected) continue;

    const startsAt = new Date(now.getTime() - 5 * 86400000);
    const endsAt = new Date(now.getTime() + 25 * 86400000);

    const existing = await prisma.subscription.findFirst({
      where: { userId: target.user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: selected.plan.id,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          paymentId: selected.payment.id,
          canceledAt: null,
        },
      });
    } else {
      const subscriptionByPayment = await prisma.subscription.findUnique({
        where: { paymentId: selected.payment.id },
      });

      if (subscriptionByPayment) {
        await prisma.subscription.update({
          where: { id: subscriptionByPayment.id },
          data: {
            userId: target.user.id,
            planId: selected.plan.id,
            status: 'ACTIVE',
            startsAt,
            endsAt,
            canceledAt: null,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: target.user.id,
            planId: selected.plan.id,
            status: 'ACTIVE',
            startsAt,
            endsAt,
            paymentId: selected.payment.id,
          },
        });
      }
    }
  }

  console.info('GridHand seed completed.', {
    users: 3,
    plans: plans.length,
    demoPayments: seededPayments.length,
  });
}

main()
  .catch((error) => {
    console.error('GridHand seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });