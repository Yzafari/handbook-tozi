import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', subscriptionController.mySubscription);
router.post('/me/cancel', subscriptionController.cancel);

export default router;
