import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().int().nonnegative(),
  durationDays: z.number().int().positive().max(3650),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();
export const idParamSchema = z.object({ id: z.string().trim().min(1).max(128) });

export default { createPlanSchema, updatePlanSchema, idParamSchema };
