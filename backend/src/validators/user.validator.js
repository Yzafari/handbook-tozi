import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(255).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
});
