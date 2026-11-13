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
  const entry = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix));

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
  headers: {
    Accept: 'application/json'
  }
});

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
  return (
    error?.response?.status === 401 &&
    error?.response?.data?.error?.code === 'TOKEN_EXPIRED'
  );
}

function dispatchAuthLogout() {
  setAccessToken(null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = getCookie('gh_csrf');

      if (!csrfToken) {
        throw new Error('CSRF token is missing');
      }

      const response = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken
          }
        }
      );

      const data = response?.data?.data;
      const token = data?.accessToken;

      if (!token) {
        throw new Error('Refresh response did not include an access token');
      }

      setAccessToken(token);

      return token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    if (
      !originalRequest ||
      !isExpiredTokenError(error) ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
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

/**
 * Converts an Axios response promise to its envelope data.
 * Usage: const user = await unwrap(api.get('/users/me'));
 */
export async function unwrap(promise) {
  const response = await promise;
  return response?.data?.data;
}

/**
 * Extracts the backend's Persian error message.
 */
export function getErrorMessage(error) {
  const envelopeMessage = error?.response?.data?.error?.message;
  const legacyMessage = error?.response?.data?.message;

  if (typeof envelopeMessage === 'string' && envelopeMessage.trim()) {
    return envelopeMessage;
  }

  if (typeof legacyMessage === 'string' && legacyMessage.trim()) {
    return legacyMessage;
  }

  if (error?.code === 'ERR_NETWORK') {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
  }

  if (error?.response?.status === 429) {
    return 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.';
  }

  return error?.message || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
}

export default api;