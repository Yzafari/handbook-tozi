import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Must match SALT_ROUNDS in backend/src/utils/hash.util.js so seeded
// passwords verify against the same hashing configuration used at runtime.
const SALT_ROUNDS = 10;

// Seed accounts. Passwords are overridable via env so real secrets never
// need to be committed to the repository.
const SEED_USERS = [
  {
    label: 'super admin',
    email: process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@example.com',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
    // The current schema.prisma Role enum only defines ADMIN and USER, so the
    // super admin is seeded as an ADMIN distinguished by its email address.
    // Add SUPER_ADMIN to the enum to give it a distinct role.
    role: 'ADMIN',
  },
  {
    label: 'admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    role: 'ADMIN',
  },
  {
    label: 'user',
    email: process.env.SEED_USER_EMAIL || 'user@example.com',
    password: process.env.SEED_USER_PASSWORD || 'User@123',
    role: 'USER',
  },
];

// The current Plan model has no isActive field, so these are simply the three
// plans that will exist after seeding.
const SEED_PLANS = [
  { name: 'Basic', price: 99000 },
  { name: 'Pro', price: 199000 },
  { name: 'Enterprise', price: 499000 },
];

async function seedUsers() {
  for (const user of SEED_USERS) {
    const password = await bcrypt.hash(user.password, SALT_ROUNDS);

    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { password, role: user.role },
      create: { email: user.email, password, role: user.role },
    });

    console.log(`[seed] ${user.label} ready: ${record.email} (role=${record.role})`);
  }
}

async function seedPlans() {
  for (const plan of SEED_PLANS) {
    // Plan.name is not unique in the schema, so upsert-by-name is not possible.
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: { price: plan.price },
      });
      console.log(`[seed] plan updated: ${plan.name} (${plan.price})`);
    } else {
      await prisma.plan.create({ data: { name: plan.name, price: plan.price } });
      console.log(`[seed] plan created: ${plan.name} (${plan.price})`);
    }
  }
}

async function main() {
  console.log('[seed] starting...');
  await seedUsers();
  await seedPlans();
  console.log('[seed] done.');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
