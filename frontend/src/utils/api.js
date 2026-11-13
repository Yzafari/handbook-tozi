// frontend/src/utils/api.js
import axios from 'axios';

const BASE_URL = '/api';

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token ? token : null;
}

export function getAccessToken() {
  return accessToken;
}

export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return entry.slice(prefix.length);
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' }
});

// اینترسپتور درخواست برای تزریق امن توکن
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function isExpiredTokenError(error) {
  return error?.response?.status === 401 && (
    error?.response?.data?.error?.code === 'TOKEN_EXPIRED' ||
    error?.response?.data?.code === 'UNAUTHORIZED'
  );
}

function dispatchAuthLogout() {
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
}

// تابع رفرش توکن هماهنگ با ساختار بک‌اند شما
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = getCookie('gh_csrf');
      
      const headers = { Accept: 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
        withCredentials: true,
        headers
      });

      const data = response?.data?.data;
      // سازگاری کامل با هر دو کلید token یا accessToken ارسالی از بک‌اند
      const token = data?.token || data?.accessToken; 

      if (!token) throw new Error('Refresh response did not include a token');
      setAccessToken(token);
      return token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// اینترسپتور پاسخ برای تمدید خودکار توکن منقضی شده
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (!originalRequest || !isExpiredTokenError(error) || originalRequest._retry || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const token = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api(originalRequest);
    } catch (refreshError) {
      dispatchAuthLogout();
      return Promise.reject(refreshError);
    }
  }
);

export async function unwrap(promise) {
  const response = await promise;
  return response?.data?.data;
}

export const getErrorMessage = (error) => {
  const envelopeMessage = error?.response?.data?.error?.message;
  const legacyMessage = error?.response?.data?.message;

  if (typeof envelopeMessage === 'string' && envelopeMessage.trim()) return envelopeMessage;
  if (typeof legacyMessage === 'string' && legacyMessage.trim()) return legacyMessage;
  if (error?.code === 'ERR_NETWORK') return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
  return error?.message || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
};

export default api;
export { api };
