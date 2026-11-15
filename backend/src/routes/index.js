import { Router } from 'express';
import { ok } from '../utils/response.util.js';
import { paymentLimiter } from '../middlewares/rateLimit.middleware.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import planRoutes from './plan.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (req, res) => ok(res, { status: 'up' }));

// Stricter per-IP limiters are applied here so route pieces cannot forget them.
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/plans', planRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payment', paymentLimiter, paymentRoutes);
router.use('/admin', adminRoutes);

export default router;