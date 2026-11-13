import { api } from '../utils/api';

// گرفتن لیست پلن‌ها از بک‌اند
export const getPlans = async () => {
  try {
    const response = await api.get('/plans'); 
    // اگر ساختار پاسخ بک‌اند فرق داشت (مثلا response.data)، اینجا تغییر بده
    return response.data.data || response.data; 
  } catch (error) {
    console.error('خطا در دریافت پلن‌ها:', error);
    throw error;
  }
};