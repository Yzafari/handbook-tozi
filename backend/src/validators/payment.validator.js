
import { z } from 'zod';

export const createPaymentSchema = z.object({
  planId: z.string().trim().min(1).max(128),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export default { createPaymentSchema };
