import axios from 'axios';
import { env } from '../../src/config/env.js';
import {
  requestPayment,
  verifyPayment,
} from '../../src/services/zarinpal.service.js';

jest.mock('axios');

describe('Zarinpal v4 service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.ZARINPAL_MERCHANT_ID = 'test-merchant-id';
    env.ZARINPAL_SANDBOX = true;
  });

  test('requests a payment in Toman using IRT and sandbox URL', async () => {
    axios.post.mockResolvedValue({
      data: {
        data: {
          code: 100,
          authority: 'A000000000000000000000000000000000',
        },
      },
    });

    const result = await requestPayment({
      amountToman: 250000,
      description: 'Subscription payment',
      callbackUrl: 'http://localhost:4000/api/payment/verify',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
      {
        merchant_id: 'test-merchant-id',
        amount: 250000,
        callback_url: 'http://localhost:4000/api/payment/verify',
        description: 'Subscription payment',
        currency: 'IRT',
      },
      expect.objectContaining({ timeout: 15000 }),
    );

    expect(result).toEqual({
      authority: 'A000000000000000000000000000000000',
      paymentUrl:
        'https://sandbox.zarinpal.com/pg/StartPay/A000000000000000000000000000000000',
    });
  });

  test('uses the production host when sandbox is disabled', async () => {
    env.ZARINPAL_SANDBOX = false;

    axios.post.mockResolvedValue({
      data: {
        data: {
          code: 100,
          authority: 'AUTH123',
        },
      },
    });

    const result = await requestPayment({
      amountToman: 10000,
      description: 'Test',
      callbackUrl: 'https://example.test/api/payment/verify',
    });

    expect(axios.post.mock.calls[0][0]).toBe(
      'https://payment.zarinpal.com/pg/v4/payment/request.json',
    );
    expect(result.paymentUrl).toBe(
      'https://payment.zarinpal.com/pg/StartPay/AUTH123',
    );
  });

  test('rejects a request when the gateway does not return code 100', async () => {
    axios.post.mockResolvedValue({
      data: { data: { code: -1, message: 'Invalid request' } },
    });

    await expect(
      requestPayment({
        amountToman: 10000,
        description: 'Test',
        callbackUrl: 'https://example.test/callback',
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'PAYMENT_ERROR',
    });
  });

  test('verifies using the supplied database amount and returns gateway details', async () => {
    axios.post.mockResolvedValue({
      data: {
        data: {
          code: 100,
          ref_id: 123456,
          card_pan: '603799******1234',
        },
      },
    });

    await expect(
      verifyPayment({
        amountToman: 450000,
        authority: 'AUTH123',
      }),
    ).resolves.toEqual({
      code: 100,
      refId: '123456',
      cardPan: '603799******1234',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      {
        merchant_id: 'test-merchant-id',
        amount: 450000,
        authority: 'AUTH123',
        currency: 'IRT',
      },
      expect.objectContaining({ timeout: 15000 }),
    );
  });

  test('preserves code 101 for already-verified payments', async () => {
    axios.post.mockResolvedValue({
      data: { data: { code: 101, ref_id: 123456 } },
    });

    await expect(
      verifyPayment({
        amountToman: 10000,
        authority: 'AUTH123',
      }),
    ).resolves.toEqual({
      code: 101,
      refId: '123456',
      cardPan: null,
    });
  });

  test('wraps network errors as PAYMENT_ERROR without exposing credentials', async () => {
    axios.post.mockRejectedValue(new Error('Connection timed out'));

    await expect(
      requestPayment({
        amountToman: 10000,
        description: 'Test',
        callbackUrl: 'https://example.test/callback',
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'PAYMENT_ERROR',
    });
  });
});