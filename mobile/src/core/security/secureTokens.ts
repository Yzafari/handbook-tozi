import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'handbook.refresh-token.v1';

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

const USER_CACHE_KEY = 'handbook_user_v1';

export async function saveCachedUser(user: { id: string; email: string; name: string; role: string; jobRole: string | null; province: string | null }): Promise<void> {
  await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function readCachedUser(): Promise<{ id: string; email: string; name: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; jobRole: string | null; province: string | null } | null> {
  const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;
    return { ...user, jobRole: typeof user.jobRole === 'string' ? user.jobRole : null, province: typeof user.province === 'string' ? user.province : null };
  } catch { return null; }
}

export async function clearCachedUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
}
