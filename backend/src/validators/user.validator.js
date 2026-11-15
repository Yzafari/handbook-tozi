import { z } from 'zod';
import { JOB_ROLE_VALUES } from '../config/job-roles.js';
import { PROVINCE_VALUES } from '../config/provinces.js';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/).optional().or(z.literal('')),
  jobRole: z.enum(JOB_ROLE_VALUES).optional(),
  province: z.enum(PROVINCE_VALUES).optional(),
}).strict();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
