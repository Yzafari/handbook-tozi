import axios from 'axios';
import { api, getApiBaseUrl, restoreSession, setAccessToken } from './api';
import { clearRefreshToken, saveRefreshToken, saveCachedUser, clearCachedUser, readRefreshToken } from '../security/secureTokens';

export type AuthUser = { id: string; email: string; name: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; jobRole: string | null; province: string | null };
export type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await api.post('/auth/login', { email, password });
  const data = response.data?.data as AuthResponse;
  if (!data?.accessToken || !data?.refreshToken || !data?.user) throw new Error('پاسخ ورود از سرور معتبر نیست');
  setAccessToken(data.accessToken);
  await saveRefreshToken(data.refreshToken);
  await saveCachedUser(data.user);
  return data.user;
}

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
};

/**
 * Creates the account and signs it in with the tokens the API returns for the
 * new session, so a successful sign-up lands the user straight in the app.
 */
export async function register(input: RegisterInput): Promise<AuthUser> {
  const response = await api.post('/auth/register', input);
  const data = response.data?.data as AuthResponse | { user?: AuthUser };
  const session = data as AuthResponse;
  if (!session?.accessToken || !session?.refreshToken || !session?.user) {
    throw new Error('پاسخ ثبت‌نام از سرور معتبر نیست');
  }
  setAccessToken(session.accessToken);
  await saveRefreshToken(session.refreshToken);
  await saveCachedUser(session.user);
  return session.user;
}

export async function restoreAuthenticatedUser(): Promise<AuthUser | null> {
  const data = await restoreSession();
  return data?.user ?? null;
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = await readRefreshToken();
    if (refreshToken) await axios.post(`${getApiBaseUrl()}/auth/logout`, { refreshToken }, { timeout: 20000 });
  } finally {
    setAccessToken(null);
    await clearRefreshToken();
    await clearCachedUser();
  }
}
