// frontend/src/utils/api.js
// Canonical Axios client for the whole frontend.
// Every service/component must import this instance (directly or through
// services/api.js) so authentication, CSRF and refresh logic live in one place.
import axios from 'axios';

const BASE_URL = '/api';
const CSRF_COOKIE = 'gh_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['get', 'head', 'options']);
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/csrf-token'];

let accessToken = null;
let refreshPromise = null;
let csrfPromise = null;

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
  headers: { Accept: 'application/json' },
});

// Fetches (and caches) the CSRF token. Uses the raw axios module on purpose so
// this call can never re-enter the interceptors below.
export async function ensureCsrfToken() {
  const existing = getCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!csrfPromise) {
    csrfPromise = axios
      .get(`${BASE_URL}/auth/csrf-token`, {
        withCredentials: true,
        headers: { Accept: 'application/json' },
      })
      .then((response) => response?.data?.data?.csrfToken || getCookie(CSRF_COOKIE) || null)
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
}

// Request interceptor: injects the bearer token and, for every unsafe method,
// the CSRF token the backend requires.
api.interceptors.request.use(
  async (config) => {
    config.headers = config.headers ?? {};

    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }

    const method = (config.method || 'get').toLowerCase();
    if (!SAFE_METHODS.has(method) && !config.headers[CSRF_HEADER]) {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) {
        config.headers[CSRF_HEADER] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

function isExpiredTokenError(error) {
  const status = error?.response?.status;
  if (status !== 401) return false;
  const code = error?.response?.data?.error?.code || error?.response?.data?.code;
  return code === 'TOKEN_EXPIRED';
}

function isAuthEndpoint(url) {
  const target = typeof url === 'string' ? url : '';
  return AUTH_ENDPOINTS.some((endpoint) => target.includes(endpoint));
}

function dispatchAuthLogout() {
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
}

// Single, deduplicated refresh handshake. Returns both the new access token and
// the user payload (when the backend includes it) so callers never re-implement it.
export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = await ensureCsrfToken();
      if (!csrfToken) throw new Error('CSRF token is missing');

      const response = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: { Accept: 'application/json', [CSRF_HEADER]: csrfToken },
        },
      );

      const data = response?.data?.data ?? {};
      // Accept both `token` and `accessToken` shapes from the backend.
      const token = data?.token || data?.accessToken;
      if (!token) throw new Error('Refresh response did not include a token');

      setAccessToken(token);
      return { token, user: data?.user ?? null, data };
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function refreshAccessToken() {
  const { token } = await refreshSession();
  return token;
}

// Response interceptor: transparently refreshes an expired access token once,
// and clears the session when the refresh itself fails.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (!originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (isExpiredTokenError(error) && !originalRequest._retry) {
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

    if (status === 401) {
      dispatchAuthLogout();
    }

    return Promise.reject(error);
  },
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
