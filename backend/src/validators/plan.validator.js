import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1).max(255).nonempty(),
  description: z.string().min(1).max(255).nonempty(),
  price: z.number().positive(),
  duration: z.number().positive(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(255).optional(),
  price: z.number().positive().optional(),
  duration: z.number().positive().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
