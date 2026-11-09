import { prisma } from '../prisma.js';


export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
  });
  return plans.map(toPublicPlan);
}

export async function getPlanById(id) {
  const plan = await prisma.plan.findUnique({
    where: { id },
  });
  return plan ? toPublicPlan(plan) : null;
}

export function toPublicPlan(plan) {
  if (!plan) return null;
  const { id, name, description, price, duration, createdAt, updatedAt } = plan;
  return { id, name, description, price, duration, createdAt, updatedAt };
}
