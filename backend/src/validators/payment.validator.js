
import { z } from 'zod';

export const createPaymentSchema = z.object({
  planId: z.string().trim().min(1).max(128),
  amountToman: z.number()
    .int('amountToman must be an integer')
    .positive('amountToman must be a positive integer')
    .safe('amountToman must be a safe integer')
    .optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export default { createPaymentSchema };
