import { Router } from 'express';
import { ok } from '../../utils/response.util.js';
import authRoutes from './auth.routes.js';
import userRoutes from '../user.routes.js';
import planRoutes from '../plan.routes.js';
import subscriptionRoutes from '../subscription.routes.js';
import paymentRoutes from '../payment.routes.js';
import { paymentLimiter } from '../../middlewares/rateLimit.middleware.js';
import { discoverAndRegisterModules, mountRegisteredModules } from '../../core/module-registry.js';

const router = Router();
router.get('/health', (req, res) => ok(res, { status: 'up', apiVersion: 'v1' }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/plans', planRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payment', paymentLimiter, paymentRoutes);

// Modules opt in through an enabled manifest and are mounted at their own basePath.
await discoverAndRegisterModules();
mountRegisteredModules(router);

export default router;
