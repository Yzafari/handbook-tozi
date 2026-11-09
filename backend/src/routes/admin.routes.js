import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { ROLES } from '../config/constants.js';

import {
  listUsersQuery,
  updateUserBody,
  listPaymentsQuery,
  revenueQuery,
  auditQuery,
  idParamSchema,
  createPlanSchema,
  updatePlanSchema,
} from '../validators/admin.validator.js';

import * as adminController from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/stats', adminController.getStats);
router.get(
  '/stats/revenue',
  validate({ query: revenueQuery }),
  adminController.getRevenueSeries,
);

router.get(
  '/users',
  validate({ query: listUsersQuery }),
  adminController.listUsers,
);
router.get(
  '/users/:id',
  validate({ params: idParamSchema }),
  adminController.getUserDetail,
);
router.patch(
  '/users/:id',
  validate({ params: idParamSchema, body: updateUserBody }),
  adminController.updateUser,
);

router.get(
  '/payments',
  validate({ query: listPaymentsQuery }),
  adminController.listPayments,
);
router.get(
  '/payments/:id',
  validate({ params: idParamSchema }),
  adminController.getPaymentDetail,
);

router.get(
  '/audit-logs',
  validate({ query: auditQuery }),
  adminController.listAuditLogs,
);

router.get('/plans', adminController.listAllPlans);

router.post(
  '/plans',
  authorizeRoles(ROLES.SUPER_ADMIN),
  validate({ body: createPlanSchema }),
  adminController.createPlan,
);
router.patch(
  '/plans/:id',
  authorizeRoles(ROLES.SUPER_ADMIN),
  validate({ params: idParamSchema, body: updatePlanSchema }),
  adminController.updatePlan,
);
router.delete(
  '/plans/:id',
  authorizeRoles(ROLES.SUPER_ADMIN),
  validate({ params: idParamSchema }),
  adminController.deletePlan,
);

export default router;