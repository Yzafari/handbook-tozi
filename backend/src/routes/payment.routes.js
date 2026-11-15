import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createPaymentSchema } from '../validators/payment.validator.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Gateway callback is a browser redirect and is validated by authority verification.
router.get('/verify', paymentController.verifyCallback);
// Optional server-to-server adapter endpoint. Zarinpal v4 does not itself guarantee webhook delivery.
router.post('/webhook', paymentController.webhookHandler);

router.use(authenticate);

router.post(
  '/request',
  validate({ body: createPaymentSchema }),
  paymentController.requestPayment
);

router.get('/:id', paymentController.getPayment);

export default router;
