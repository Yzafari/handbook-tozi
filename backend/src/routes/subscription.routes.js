import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', subscriptionController.getMySubscription);
router.post('/me/cancel', subscriptionController.cancelMySubscription);

export default router;
