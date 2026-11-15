import { Router } from 'express';
import { z } from 'zod';
import { optionalAuthenticate } from '../../middlewares/auth.middleware.js';
import { searchLimiter } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './search.controller.js';

const router = Router();
const querySchema = z.object({
  q: z.string().trim().min(2).max(200), cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['pdf', 'image', 'text']).optional(), language: z.enum(['fa', 'en', 'ku']).optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
}).refine(data => !data.from || !data.to || data.from <= data.to, { message: 'from must be before to', path: ['from'] });
router.use(optionalAuthenticate);
router.get('/', searchLimiter, validate({ query: querySchema }), controller.search);
export default router;
