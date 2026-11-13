const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // ساخت کاربر ادمین
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gridhand.com' },
    update: {},
    create: {
      email: 'admin@gridhand.com',
      password: adminPassword,
      name: 'مدیر سیستم',
      role: 'ADMIN',
    },
  });
  console.log('ادمین ساخته شد:', admin.email);

  // ساخت یک پلن پیش‌فرض
  const plan = await prisma.plan.upsert({
    where: { id: 'default-plan-1' },
    update: {},
    create: {
      id: 'default-plan-1',
      name: 'پلن یک ماهه',
      description: 'دسترسی به تمام امکانات برای یک ماه',
      price: 100000,
      durationDays: 30,
      isActive: true,
    },
  });
  console.log('پلن ساخته شد:', plan.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });