import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;