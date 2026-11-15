import { z } from 'zod';

export const createPaymentSchema = z.object({
  planId: z.string().trim().min(1).max(128),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  durationDays: z.coerce
    .number({ invalid_type_error: 'durationDays must be a number' })
    .int('durationDays must be an integer')
    .positive('durationDays must be a positive integer')
    .max(3650, 'durationDays is too large')
    .optional(),
});

export default { createPaymentSchema };
