import { z } from 'zod';

export const createPaymentSchema = z.object({
  planId: z.coerce
    .number({ invalid_type_error: 'planId must be a number' })
    .int('planId must be an integer')
    .positive('planId must be a positive integer'),
  durationDays: z.coerce
    .number({ invalid_type_error: 'durationDays must be a number' })
    .int('durationDays must be an integer')
    .positive('durationDays must be a positive integer')
    .max(3650, 'durationDays is too large')
    .optional(),
});

export default { createPaymentSchema };
