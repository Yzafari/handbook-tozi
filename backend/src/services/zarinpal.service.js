import axios from 'axios';
import { AppError } from '../utils/response.util.js';
import logger from '../utils/logger.util.js';

const ZARINPAL_CODES = {
  SUCCESS: 100,
  ALREADY_VERIFIED: 101,
};

function getConfig() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    throw new AppError(500, 'CONFIG_ERROR', 'ZARINPAL_MERCHANT_ID is not set');
  }

  const sandbox = String(process.env.ZARINPAL_SANDBOX).toLowerCase() === 'true';
  const baseUrl = sandbox
    ? 'https://sandbox.zarinpal.com/pg/v4/payment'
    : 'https://api.zarinpal.com/pg/v4/payment';
  const startPayBase = sandbox
    ? 'https://sandbox.zarinpal.com/pg/StartPay'
    : 'https://www.zarinpal.com/pg/StartPay';

  return { merchantId, baseUrl, startPayBase };
}

function extractError(response) {
  const errors = response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    return {
      code: first?.code,
      message: first?.message || 'Zarinpal request failed',
    };
  }
  return { code: undefined, message: 'Zarinpal request failed' };
}

/**
 * Request a new payment from Zarinpal.
 *
 * @param {Object} params
 * @param {number} params.amount        Amount in Rials (Zarinpal v4 default unit).
 * @param {string} params.callbackUrl   URL Zarinpal redirects the user back to.
 * @param {string} [params.description] Payment description shown to the user.
 * @param {string} [params.email]       Optional payer email.
 * @param {string} [params.mobile]      Optional payer mobile number.
 * @returns {Promise<{ authority: string, paymentUrl: string, fee: number }>}
 */
export function getPaymentUrl(authority) {
  if (!authority || typeof authority !== 'string') throw new AppError(400, 'VALIDATION_ERROR', 'authority is required');
  const { startPayBase } = getConfig();
  return `${startPayBase}/${encodeURIComponent(authority)}`;
}

export async function requestPayment({ amount, callbackUrl, description, email, mobile }) {
  if (!amount || Number(amount) <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'amount must be a positive number');
  }
  if (!callbackUrl) {
    throw new AppError(400, 'VALIDATION_ERROR', 'callbackUrl is required');
  }

  const { merchantId, baseUrl, startPayBase } = getConfig();

  const payload = {
    merchant_id: merchantId,
    amount: Math.round(Number(amount)),
    callback_url: callbackUrl,
    description: description || 'پرداخت اشتراک',
  };

  const metadata = {};
  if (email) metadata.email = email;
  if (mobile) metadata.mobile = mobile;
  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  let response;
  try {
    response = await axios.post(`${baseUrl}/request.json`, payload, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000,
    });
  } catch (error) {
    logger.error('Zarinpal requestPayment network error:', error?.message);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'خطا در ارتباط با درگاه پرداخت');
  }

  const data = response?.data?.data;
  if (!data || data.code !== ZARINPAL_CODES.SUCCESS || !data.authority) {
    const { code, message } = extractError(response);
    logger.error('Zarinpal requestPayment failed:', { code, message });
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', message, { code });
  }

  return {
    authority: data.authority,
    paymentUrl: `${startPayBase}/${data.authority}`,
    fee: data.fee ?? 0,
  };
}

/**
 * Verify a payment with Zarinpal.
 *
 * @param {Object} params
 * @param {number} params.amount     Amount in Rials (must match the request amount).
 * @param {string} params.authority  Authority returned by Zarinpal on callback.
 * @returns {Promise<{ refId: string, cardPan: string|null, code: number }>}
 */
export async function verifyPayment({ amount, authority }) {
  if (!amount || Number(amount) <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'amount must be a positive number');
  }
  if (!authority) {
    throw new AppError(400, 'VALIDATION_ERROR', 'authority is required');
  }

  const { merchantId, baseUrl } = getConfig();

  const payload = {
    merchant_id: merchantId,
    amount: Math.round(Number(amount)),
    authority,
  };

  let response;
  try {
    response = await axios.post(`${baseUrl}/verify.json`, payload, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000,
    });
  } catch (error) {
    logger.error('Zarinpal verifyPayment network error:', error?.message);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'خطا در ارتباط با درگاه پرداخت');
  }

  const data = response?.data?.data;
  const code = data?.code;

  if (code !== ZARINPAL_CODES.SUCCESS && code !== ZARINPAL_CODES.ALREADY_VERIFIED) {
    const { code: errCode, message } = extractError(response);
    logger.error('Zarinpal verifyPayment failed:', { code: errCode, message });
    throw new AppError(400, 'PAYMENT_VERIFICATION_FAILED', message, { code: errCode });
  }

  return {
    refId: String(data.ref_id),
    cardPan: data.card_pan ?? null,
    code,
  };
}

export default { requestPayment, verifyPayment, getPaymentUrl };
