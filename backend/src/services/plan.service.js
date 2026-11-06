import prisma from '../config/database.js';
import { AppError } from '../utils/response.util.js';

export function toPublicPlan(plan) {
  let features = [];
  if (Array.isArray(plan.features)) {
    features = plan.features;
  } else if (typeof plan.features === 'string') {
    try {
      features = JSON.parse(plan.features);
    } catch {
      features = [];
    }
  }

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? null,
    priceToman: plan.priceToman,
    durationDays: plan.durationDays,
    features,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
  };
}

export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return plans.map(toPublicPlan);
}

export async function getPlanById(id) {
  const plan = await prisma.plan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'پلن یافت نشد');
  }

  return plan;
}