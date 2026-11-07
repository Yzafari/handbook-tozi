import { env } from '../config/env.js';
import { ok, created } from '../utils/response.util.js';
import asyncHandler from '../utils/asyncHandler.util.js';
import {
  createPaymentRequest,
  handleCallback,
  handleWebhook,
  getPaymentForUser,
} from '../services/payment.service.js';

function resultUrl(outcome, paymentId) {
  const url = new URL('/payment/result', env.FRONTEND_URL);
  url.searchParams.set('status', outcome);

  if (paymentId) {
    url.searchParams.set('paymentId', paymentId);
  }

  return url.toString();
}

export const requestPayment = asyncHandler(async (req, res) => {
  const result = await createPaymentRequest(
    req.user.id,
    req.body,
    req,
  );

  return created(res, result, 'Payment request created.');
});

export const verifyCallback = asyncHandler(async (req, res) => {
  let result = { paymentId: null, outcome: 'failed' };

  try {
    result = await handleCallback(
      {
        authority: req.query.Authority,
        status: req.query.Status,
      },
      req,
    );
  } catch {
    // Do not expose gateway errors, authorities, or internal details
    // to the browser. The frontend displays a generic result.
    result = { paymentId: null, outcome: 'failed' };
  }

  return res.redirect(
    302,
    resultUrl(result.outcome, result.paymentId),
  );
});

export const getPayment = asyncHandler(async (req, res) => {
  const payment = await getPaymentForUser(
    req.user.id,
    req.params.id,
  );

  return ok(res, { payment });
});

export const webhook = asyncHandler(async (req, res) => {
  // payment.routes.js must install express.raw() before this handler.
  // The service authenticates the exact bytes before parsing JSON.
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Raw webhook body is required.',
      },
    });
  }

  const result = await handleWebhook(
    req.body,
    req.get('X-Signature'),
  );

  return ok(res, result, 'Webhook processed.');
});