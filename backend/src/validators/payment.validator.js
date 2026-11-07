import { z } from 'zod';

export const requestPaymentSchema = z.object({
  planId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
}).strict();

export const verifyQuerySchema = z.object({
  Authority: z.string().trim().min(1).max(128),
  Status: z.enum(['OK', 'NOK']),
}).strict();

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const webhookBodySchema = z.object({
  authority: z.string().trim().min(1).max(128),
}).strict();