import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { readRefreshToken, saveRefreshToken, clearRefreshToken, clearCachedUser } from '../security/secureTokens';

const API_PORT = 3000;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * Resolves the API base URL.
 *
 * - `EXPO_PUBLIC_API_URL` is the single source of truth; Expo inlines it at
 *   build time, so release builds never ship a developer's LAN address.
 * - In development the Expo dev-server host is used as a fallback so a
 *   physical device on the same Wi-Fi can reach the local backend.
 * - In a release build without the variable we fail loudly instead of
 *   silently calling an unreachable IP.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    return `http://${host ?? 'localhost'}:${API_PORT}/api/v1`;
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Configure it before building a release (see mobile/.env.example).'
  );
}

// Resolved lazily so a missing EXPO_PUBLIC_API_URL surfaces as a single clear
// request error instead of crashing the bundle while it is being imported.
let resolvedBaseUrl: string | null = null;
const resolveBaseUrl = (): string => {
  if (!resolvedBaseUrl) resolvedBaseUrl = getApiBaseUrl();
  return resolvedBaseUrl;
};

export const api = axios.create({ timeout: 20000, headers: { Accept: 'application/json' } });
let accessToken: string | null = null;
let refreshPromise: Promise<any> | null = null;
let authExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function setAuthExpiredHandler(handler: (() => void) | null) { authExpiredHandler = handler; }

async function refreshSession(): Promise<any> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      const response = await axios.post(`${getApiBaseUrl()}/auth/refresh`, { refreshToken }, { timeout: 20000 });
      const data = response.data?.data;
      if (!data?.accessToken || !data?.refreshToken || !data?.user) throw new Error('Invalid refresh response');
      await saveRefreshToken(data.refreshToken);
      setAccessToken(data.accessToken);
      return data;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function restoreSession(): Promise<any | null> {
  const existingRefreshToken = await readRefreshToken();
  if (!existingRefreshToken) { setAccessToken(null); await clearCachedUser(); return null; }
  try { return await refreshSession(); }
  catch (error: any) {
    setAccessToken(null);
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      await clearRefreshToken();
      await clearCachedUser();
    }
    // Network/server errors preserve the refresh token and encrypted local user cache.
    return null;
  }
}

api.interceptors.request.use(async (request: InternalAxiosRequestConfig) => {
  if (!request.baseURL) request.baseURL = resolveBaseUrl();
  if (accessToken) request.headers.Authorization = `Bearer ${accessToken}`;
  return request;
});

api.interceptors.response.use((response: any) => response, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  const authEndpoint = /\/auth\/(login|register|refresh|logout)(\?|$)/.test(request?.url ?? '');
  if (!request || error.response?.status !== 401 || request._retry || authEndpoint) throw error;
  request._retry = true;
  try {
    const session = await refreshSession();
    request.headers.Authorization = `Bearer ${session.accessToken}`;
    return api(request);
  } catch (refreshError: any) {
    setAccessToken(null);
    if (refreshError?.response?.status === 401 || refreshError?.response?.status === 403) {
      await clearRefreshToken();
      await clearCachedUser();
      authExpiredHandler?.();
    }
    throw refreshError;
  }
});
