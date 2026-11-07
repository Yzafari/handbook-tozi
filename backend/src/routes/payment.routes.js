import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createPaymentSchema } from '../validators/payment.validator.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Public: Zarinpal redirects the user's browser here, so no auth.
// Must be registered before '/:id' or it will be matched as an id.
router.get('/verify', paymentController.verifyCallback);

router.use(authenticate);

router.post(
  '/request',
  validate({ body: createPaymentSchema }),
  paymentController.requestPayment
);

router.get('/:id', paymentController.getPayment);

export default router;
