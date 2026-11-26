import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { login as performLogin, logout as performLogout, register as performRegister, restoreAuthenticatedUser } from '../network/auth';
import type { AuthUser, RegisterInput } from '../network/auth';
import { startAutoSync } from '../sync/autoSync';
import { api, restoreSession, setAuthExpiredHandler } from '../network/api';
import { readCachedUser, saveCachedUser } from '../security/secureTokens';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: { province?: string; jobRole?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionAuthenticated, setSessionAuthenticated] = useState(false);

  useEffect(() => {
    setAuthExpiredHandler(() => { setSessionAuthenticated(false); setUser(null); });
    return () => setAuthExpiredHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    restoreAuthenticatedUser().then(async restored => {
      if (active) {
        setSessionAuthenticated(Boolean(restored));
        setUser(restored ?? await readCachedUser());
      }
    })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionAuthenticated || !user?.id) return;
    return startAutoSync(user.id);
  }, [sessionAuthenticated, user?.id]);

  useEffect(() => {
    if (sessionAuthenticated || loading) return;
    let active = true;
    const retry = async () => {
      const restored = await restoreAuthenticatedUser();
      if (active && restored) {
        setUser(restored);
        setSessionAuthenticated(true);
      }
    };
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => { if (state === 'active') void retry(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void retry(); }, 60_000);
    return () => { active = false; clearInterval(interval); subscription.remove(); };
  }, [sessionAuthenticated, loading]);

  const login = useCallback(async (email: string, password: string) => {
    const authenticated = await performLogin(email, password);
    setUser(authenticated);
    setSessionAuthenticated(true);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const authenticated = await performRegister(input);
    setUser(authenticated);
    setSessionAuthenticated(true);
  }, []);

  const updateProfile = useCallback(async (patch: { province?: string; jobRole?: string }) => {
    const response = await api.patch('/users/me', patch);
    const updated = response.data?.data?.user as AuthUser | undefined;
    if (!updated) return;

    // The PATCH above succeeded with a valid access token, so the user is
    // authenticated. Refreshing the session here is best-effort: a transient
    // network failure while calling /auth/refresh must not sign the user out
    // or stop auto-sync. Only a successful refresh updates the cached user and
    // (re)confirms the session; a failed one leaves `sessionAuthenticated`
    // untouched. If the refresh token was actually rejected, the API layer
    // clears it and the auth-expired handler flips `sessionAuthenticated` on
    // the next 401 response.
    let current: AuthUser = updated;
    try {
      const refreshed = await restoreSession();
      const refreshedUser = refreshed?.user as AuthUser | undefined;
      if (refreshedUser) {
        current = refreshedUser;
        setSessionAuthenticated(true);
      }
    } catch {
      // Transient failure: keep the existing session state.
    }

    setUser(current);
    await saveCachedUser(current);
  }, []);

  const logout = useCallback(async () => {
    try { await performLogout(); }
    finally {
      setUser(null);
      setSessionAuthenticated(false);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateProfile }), [user, loading, login, register, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
