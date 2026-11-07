import asyncHandler from '../utils/asyncHandler.util.js';
import { ok, created } from '../utils/response.util.js';
import * as paymentService from '../services/payment.service.js';

export const requestPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.createPaymentRequest(req.user.id, req.body, req);
  return created(res, result, 'درخواست پرداخت با موفقیت ایجاد شد');
});

export const verifyCallback = asyncHandler(async (req, res) => {
  const params = {
    authority: req.query.authority || req.query.Authority,
    status: req.query.status || req.query.Status,
  };

  const result = await paymentService.handleCallback(params, req);

  const message = result.alreadyProcessed
    ? 'این پرداخت قبلا تایید شده است'
    : 'پرداخت با موفقیت تایید شد';

  return ok(res, result, message);
});

export const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentForUser(req.user.id, req.params.id);
  return ok(res, payment);
});
