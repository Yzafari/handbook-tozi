import { Router } from 'express';
import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { paymentLimiter } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  requestPaymentSchema,
  verifyQuerySchema,
  paymentIdParamSchema,
  webhookBodySchema,
} from '../validators/payment.validator.js';
import {
  requestPayment,
  verifyCallback,
  getPayment,
  webhook,
} from '../controllers/payment.controller.js';

const router = Router();

// All payment endpoints are rate-limited. Public callbacks do not require
// Bearer authentication; user-initiated requests and reads do.
router.use(paymentLimiter);

// IMPORTANT: register this router before the global express.json() parser,
// or configure that parser to skip /api/payment/webhook. express.raw() cannot
// recover the original bytes after express.json() has consumed the stream.
router.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '16kb' }),
  (req, res, next) => {
    // Reject unexpected content types rather than accepting an empty body.
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Expected application/json raw body.',
        },
      });
    }

    // The service validates HMAC before JSON parsing.
    // Schema validation follows signature verification in handleWebhook().
    return next();
  },
  webhook,
);

router.post(
  '/request',
  authenticate,
  validate({ body: requestPaymentSchema }),
  requestPayment,
);

router.get(
  '/verify',
  validate({ query: verifyQuerySchema }),
  verifyCallback,
);

router.get(
  '/:id',
  authenticate,
  validate({ params: paymentIdParamSchema }),
  getPayment,
);

export default router;