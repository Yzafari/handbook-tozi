import { api } from '../utils/api';

// دریافت اطلاعات یک پرداخت خاص با شناسه (برای صفحه نتیجه پرداخت)
export const getPayment = async (id) => {
  try {
    const response = await api.get(`/payment/${id}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت اطلاعات پرداخت:', error);
    throw error;
  }
};

// درخواست ایجاد پرداخت جدید (اتصال به زرین‌پال)
export const createPayment = async (planId) => {
  try {
    const response = await api.post('/payment/request', { planId });
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در ایجاد درخواست پرداخت:', error);
    throw error;
  }
};

// تایید پرداخت (پس از بازگشت از درگاه)
export const verifyPayment = async (authority, status) => {
  try {
    const response = await api.post('/payment/verify', { authority, status });
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در تایید پرداخت:', error);
    throw error;
  }
};
// Checkout sends the plan ID and a stable idempotency key together.
export const requestPayment = async ({ planId, idempotencyKey }) => {
  try {
    const response = await api.post('/payment/request', { planId, idempotencyKey });
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در ایجاد درخواست پرداخت:', error);
    throw error;
  }
};
