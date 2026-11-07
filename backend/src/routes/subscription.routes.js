import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { mySubscription, cancel } from '../controllers/subscription.controller.js';

const router = Router();

router.use(authenticate);

router.get('/me', mySubscription);
router.post('/me/cancel', cancel);

export default router;