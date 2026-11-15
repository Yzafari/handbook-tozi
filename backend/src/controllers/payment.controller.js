import asyncHandler from '../utils/asyncHandler.util.js';
import { ok, created } from '../utils/response.util.js';
import * as paymentService from '../services/payment.service.js';
import crypto from 'node:crypto';
import { AppError } from '../utils/response.util.js';
import { env } from '../config/env.js';

export const requestPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.createPaymentRequest(req.user.id, req.body, req);
  return created(res, result, 'درخواست پرداخت با موفقیت ایجاد شد');
});

function paymentResultRedirect(res, paymentId, status, message) {
  const target = new URL('/payment/result', env.FRONTEND_URL);
  if (paymentId) target.searchParams.set('paymentId', paymentId);
  target.searchParams.set('status', status);
  if (message) target.searchParams.set('message', message.slice(0, 180));
  return res.redirect(303, target.toString());
}

export const verifyCallback = asyncHandler(async (req, res) => {
  const authority = req.query.authority || req.query.Authority;
  const params = { authority, status: req.query.status || req.query.Status };
  try {
    const result = await paymentService.handleCallback(params, req);
    return paymentResultRedirect(res, result.payment?.id, result.payment?.status === 'SUCCESS' ? 'success' : 'failed');
  } catch (error) {
    const payment = await paymentService.getPaymentStatusByAuthority(authority).catch(() => null);
    if (payment) return paymentResultRedirect(res, payment.id, payment.status === 'SUCCESS' ? 'success' : 'failed', error instanceof AppError ? error.message : 'تأیید پرداخت انجام نشد؛ وضعیت تراکنش را از پنل کاربری بررسی کنید.');
    return paymentResultRedirect(res, null, 'failed', 'نتیجه پرداخت قابل بازیابی نیست؛ با پشتیبانی تماس بگیرید.');
  }
});

export const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentForUser(req.user.id, req.params.id);
  return ok(res, payment);
});

export const webhookHandler = asyncHandler(async (req, res) => {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET || '';
  const supplied = String(req.headers['x-payment-webhook-secret'] || '');
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError(401, 'UNAUTHORIZED', 'اعتبارسنجی وب‌هوک ناموفق بود');
  }
  return ok(res, await paymentService.handleWebhook(req.body, req));
});
