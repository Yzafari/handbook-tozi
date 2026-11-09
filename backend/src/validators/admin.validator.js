import { z } from 'zod';

// Query strings arrive as strings, and clients often send `?status=` for an
// unset filter. Normalize blanks to undefined so `.optional()`/`.default()`
// behave as intended instead of failing coercion.
const emptyToUndefined = (value) =>
  value === '' || value === null || value === undefined ? undefined : value;

const booleanish = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return value;
}, z.boolean({ invalid_type_error: 'must be a boolean' }));

const roleEnum = z.enum(['ADMIN', 'USER'], {
  errorMap: () => ({ message: 'role must be one of ADMIN, USER' }),
});

const paymentStatusEnum = z.enum(['PENDING', 'COMPLETED', 'FAILED'], {
  errorMap: () => ({ message: 'status must be one of PENDING, COMPLETED, FAILED' }),
});

const sortOrderEnum = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'sortOrder must be asc or desc' }),
});

export const paginationQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'page must be a number' })
      .int('page must be an integer')
      .min(1, 'page must be at least 1')
      .default(1)
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'limit must be a number' })
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(100, 'limit must be at most 100')
      .default(10)
  ),
  sortOrder: z.preprocess(emptyToUndefined, sortOrderEnum.default('desc')),
});

export const updateUserSchema = z.object({
  fullName: z
    .string({ invalid_type_error: 'fullName must be a string' })
    .trim()
    .min(2, 'fullName must be at least 2 characters')
    .max(120, 'fullName must be at most 120 characters')
    .optional(),
  email: z
    .string({ invalid_type_error: 'email must be a string' })
    .trim()
    .toLowerCase()
    .email('email must be a valid email address')
    .optional(),
  phone: z
    .string({ invalid_type_error: 'phone must be a string' })
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'phone must be a valid phone number')
    .optional(),
  role: roleEnum.optional(),
  isActive: booleanish.optional(),
});

export const revenueQuerySchema = z
  .object({
    from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    groupBy: z.preprocess(
      emptyToUndefined,
      z
        .enum(['day', 'week', 'month'], {
          errorMap: () => ({ message: 'groupBy must be one of day, week, month' }),
        })
        .default('day')
    ),
    planId: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'planId must be a number' })
        .int('planId must be an integer')
        .positive('planId must be a positive integer')
        .optional()
    ),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'from must be before or equal to to',
    path: ['from'],
  });

export const paymentFilterSchema = paginationQuerySchema
  .extend({
    status: z.preprocess(emptyToUndefined, paymentStatusEnum.optional()),
    userId: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'userId must be a number' })
        .int('userId must be an integer')
        .positive('userId must be a positive integer')
        .optional()
    ),
    planId: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'planId must be a number' })
        .int('planId must be an integer')
        .positive('planId must be a positive integer')
        .optional()
    ),
    from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    minAmountToman: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'minAmountToman must be a number' })
        .int('minAmountToman must be an integer')
        .min(0, 'minAmountToman must be at least 0')
        .optional()
    ),
    maxAmountToman: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: 'maxAmountToman must be a number' })
        .int('maxAmountToman must be an integer')
        .min(0, 'maxAmountToman must be at least 0')
        .optional()
    ),
    sortBy: z.preprocess(
      emptyToUndefined,
      z
        .enum(['createdAt', 'amountToman', 'status'], {
          errorMap: () => ({ message: 'sortBy must be one of createdAt, amountToman, status' }),
        })
        .default('createdAt')
    ),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'from must be before or equal to to',
    path: ['from'],
  })
  .refine(
    (data) =>
      data.minAmountToman === undefined ||
      data.maxAmountToman === undefined ||
      data.minAmountToman <= data.maxAmountToman,
    { message: 'minAmountToman must be less than or equal to maxAmountToman', path: ['minAmountToman'] }
  );
export const auditQuery = z.object({
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(100).default(10)
  ),
  adminId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  action: z.preprocess(
    emptyToUndefined,
    z.string().optional()
  ),
});
export const createPlanSchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.number().int().positive('price must be a positive integer'),
  durationDays: z.number().int().positive('durationDays must be a positive integer'),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export const createUserSchema = z.object({
  fullName: z.string().min(2, 'fullName must be at least 2 characters'),
  email: z.string().email('email must be a valid email'),
  password: z.string().min(6, 'password must be at least 6 characters'),
  role: roleEnum.optional(),
});

export const idParamSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.coerce.number().int().positive('id must be a positive integer')),
});
export const listPaymentsQuery = paymentFilterSchema;
export default {
  paginationQuerySchema,
  updateUserSchema,
  revenueQuerySchema,
  paymentFilterSchema,
  auditQuery,
  createPlanSchema,
  updatePlanSchema,
  createUserSchema,
  idParamSchema,
  listPaymentsQuery,
};