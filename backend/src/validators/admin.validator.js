import { z } from 'zod';
import { idParamSchema, createPlanSchema, updatePlanSchema } from './plan.validator.js';
import { paginationQuerySchema } from './user.validator.js';

const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

const dateQuery = z.coerce.date();

export const listUsersQuery = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: booleanQuery.optional(),
}).strict();

export const updateUserBody = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
}).strict().refine(
  (value) => value.isActive !== undefined || value.role !== undefined,
  { message: 'حداقل یک فیلد برای تغییر الزامی است.' },
);

export const listPaymentsQuery = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED']).optional(),
  from: dateQuery.optional(),
  to: dateQuery.optional(),
  search: z.string().trim().max(200).optional(),
}).strict().refine(
  (value) => !value.from || !value.to || value.from <= value.to,
  { message: 'تاریخ شروع باید قبل از تاریخ پایان باشد.', path: ['from'] },
);

export const revenueQuery = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
}).strict();

export const auditQuery = paginationQuerySchema.extend({
  action: z.string().trim().min(1).max(100).optional(),
  userId: z.string().uuid().optional(),
}).strict();

export { idParamSchema, createPlanSchema, updatePlanSchema };