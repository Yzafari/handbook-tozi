import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'handbook.refresh-token.v1';

const isWeb = Platform.OS === 'web';

// Web fallback is for development testing only; localStorage is not secure storage.
async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore web storage failures in development fallback.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore web storage failures in development fallback.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveRefreshToken(token: string): Promise<void> {
  await setItem(REFRESH_TOKEN_KEY, token);
}

export async function readRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await deleteItem(REFRESH_TOKEN_KEY);
}

const USER_CACHE_KEY = 'handbook_user_v1';

export async function saveCachedUser(user: { id: string; email: string; name: string; role: string; jobRole: string | null; province: string | null }): Promise<void> {
  await setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export async function readCachedUser(): Promise<{ id: string; email: string; name: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; jobRole: string | null; province: string | null } | null> {
  const raw = await getItem(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;
    return { ...user, jobRole: typeof user.jobRole === 'string' ? user.jobRole : null, province: typeof user.province === 'string' ? user.province : null };
  } catch { return null; }
}

export async function clearCachedUser(): Promise<void> {
  await deleteItem(USER_CACHE_KEY);
}
