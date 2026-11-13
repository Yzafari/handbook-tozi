import { api } from '../utils/api';

// دریافت آمار درآمد برای داشبورد
export const fetchRevenueStats = async () => {
  try {
    const response = await api.get('/admin/revenue');
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت آمار درآمد:', error);
    throw error;
  }
};

// دریافت لاگ‌های سیستم (Audit Logs)
export const fetchAuditLogs = async () => {
  try {
    const response = await api.get('/admin/audit-logs');
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت لاگ‌ها:', error);
    throw error;
  }
};

// دریافت لیست تمام پرداخت‌ها
export const fetchAdminPayments = async () => {
  try {
    const response = await api.get('/admin/payments');
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت لیست پرداخت‌ها:', error);
    throw error;
  }
};

// دریافت اطلاعات یک پرداخت خاص با ID
export const fetchAdminPayment = async (id) => {
  try {
    const response = await api.get(`/admin/payments/${id}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت اطلاعات پرداخت:', error);
    throw error;
  }
};
// تابع آمار کلی داشبورد ادمین (اضافه شده برای رفع ارور)
export const fetchAdminStats = async () => {
  try {
    const response = await api.get('/admin/stats');
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت آمار ادمین:', error);
    throw error;
  }
};
// --- توابع مدیریت کاربران (اضافه شده برای رفع ارور) ---

// دریافت اطلاعات یک کاربر خاص
export const fetchAdminUser = async (id) => {
  try {
    const response = await api.get(`/admin/users/${id}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت اطلاعات کاربر:', error);
    throw error;
  }
};

// دریافت لیست تمام کاربران
export const fetchAdminUsers = async (params = {}) => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در دریافت لیست کاربران:', error);
    throw error;
  }
};

// تغییر نقش یا وضعیت کاربر
export const updateAdminUser = async (id, userData) => {
  try {
    const response = await api.put(`/admin/users/${id}`, userData);
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در بروزرسانی کاربر:', error);
    throw error;
  }
};

// حذف کاربر
export const deleteAdminUser = async (id) => {
  try {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('خطا در حذف کاربر:', error);
    throw error;
  }
};