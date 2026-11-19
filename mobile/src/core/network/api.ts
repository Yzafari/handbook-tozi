import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { readRefreshToken, saveRefreshToken, clearRefreshToken, clearCachedUser } from '../security/secureTokens';

const API_PORT = 3000;
const FALLBACK_API_BASE_URL = 'http://192.168.1.9:3000/api/v1';

/**
 * Resolves the API base URL.
 *
 * - In development, derives the host from the Expo dev server (`hostUri`)
 *   so a physical device on the same LAN can reach the backend.
 * - In production (standalone APK) or when `hostUri` is unavailable,
 *   falls back to a hardcoded LAN address.
 */
export function getApiBaseUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    if (host) {
      return `http://${host}:${API_PORT}/api/v1`;
    }
  }
  return FALLBACK_API_BASE_URL;
}

export const api = axios.create({ baseURL: getApiBaseUrl(), timeout: 20000, headers: { Accept: 'application/json' } });
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
