import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password: passwordHash, name: 'مدیر ارشد سیستم', role: 'SUPER_ADMIN' },
    });
    console.info('Configured super administrator is ready.');
  } else {
    console.info('Super administrator seed skipped: set SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD.');
  }

  await prisma.plan.upsert({
    where: { id: 'default-plan-1' },
    update: {},
    create: { id: 'default-plan-1', name: 'پلن یک ماهه', description: 'دسترسی یک ماهه', price: 100000, durationDays: 30, isActive: true },
  });
}

main().catch((error) => { console.error('Database seed failed:', error.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
