import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './sync.controller.js';

const router = Router();
const operationSchema = z.object({
  operationId: z.string().uuid(),
  moduleName: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  entityType: z.string().regex(/^[A-Z][A-Za-z0-9]{1,63}$/),
  entityId: z.string().trim().min(1).max(128),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  baseVersion: z.number().int().positive().optional(),
  payload: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
});
const pushSchema = z.object({ operations: z.array(operationSchema).min(1).max(50) });
const recordParams = z.object({ moduleName: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), entityType: z.string().regex(/^[A-Z][A-Za-z0-9]{1,63}$/), entityId: z.string().trim().min(1).max(128) });
const pullQuery = z.object({ cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(200).default(100) });
router.use(authenticate);
router.post('/push', validate({ body: pushSchema }), controller.push);
router.get('/pull', validate({ query: pullQuery }), controller.pull);
router.get('/status', controller.status);
router.get('/record/:moduleName/:entityType/:entityId', validate({ params: recordParams }), controller.record);
export default router;
