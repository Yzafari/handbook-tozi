import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.util.js';

const REQUEST_TIMEOUT_MS = 15_000;

const baseUrl = env.ZARINPAL_SANDBOX
  ? 'https://sandbox.zarinpal.com'
  : 'https://payment.zarinpal.com';

const merchantId = env.ZARINPAL_MERCHANT_ID;

function paymentError(message, details) {
  return new AppError(502, 'PAYMENT_ERROR', message, details);
}

function extractGatewayError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.errors?.[0]?.code;

  return {
    upstreamStatus: Number.isInteger(status) ? status : undefined,
    gatewayCode: code !== undefined ? String(code) : undefined,
  };
}

async function postGateway(path, payload) {
  if (!merchantId) {
    throw paymentError('Payment gateway is not configured.');
  }

  try {
    const response = await axios.post(
      `${baseUrl}${path}`,
      payload,
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    // Do not log or expose the merchant ID, request body, or credentials.
    if (error instanceof AppError) {
      throw error;
    }

    throw paymentError(
      'The payment gateway request failed.',
      extractGatewayError(error),
    );
  }
}

/**
 * Requests a Zarinpal payment.
 *
 * amountToman is an integer in Toman. The IRT currency is explicit,
 * so the amount must not be converted to Rial.
 */
export async function requestPayment({
  amountToman,
  description,
  callbackUrl,
}) {
  if (
    !Number.isSafeInteger(amountToman) ||
    amountToman <= 0 ||
    typeof description !== 'string' ||
    !description.trim() ||
    typeof callbackUrl !== 'string' ||
    !callbackUrl.trim()
  ) {
    throw paymentError('Invalid payment request parameters.');
  }

  const result = await postGateway('/pg/v4/payment/request.json', {
    merchant_id: merchantId,
    amount: amountToman,
    callback_url: callbackUrl,
    description: description.trim(),
    currency: 'IRT',
  });

  const data = result?.data;

  if (data?.code !== 100 || !data?.authority) {
    throw paymentError(
      'The payment gateway rejected the payment request.',
      {
        gatewayCode: data?.code,
      },
    );
  }

  const authority = data.authority;

  return {
    authority,
    paymentUrl: `${baseUrl}/pg/StartPay/${encodeURIComponent(authority)}`,
  };
}

/**
 * Verifies a payment using the amount stored by the application.
 * Codes 100 and 101 are returned to the caller for explicit handling.
 */
export async function verifyPayment({ amountToman, authority }) {
  if (
    !Number.isSafeInteger(amountToman) ||
    amountToman <= 0 ||
    typeof authority !== 'string' ||
    !authority.trim()
  ) {
    throw paymentError('Invalid payment verification parameters.');
  }

  const result = await postGateway('/pg/v4/payment/verify.json', {
    merchant_id: merchantId,
    amount: amountToman,
    authority: authority.trim(),
    currency: 'IRT',
  });

  const data = result?.data;

  if (!Number.isInteger(data?.code)) {
    throw paymentError('The payment gateway returned an invalid response.');
  }

  return {
    code: data.code,
    refId: data.ref_id != null ? String(data.ref_id) : null,
    cardPan: data.card_pan ?? null,
  };
}