import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { login as performLogin, logout as performLogout, restoreAuthenticatedUser } from '../network/auth';
import type { AuthUser } from '../network/auth';
import { startAutoSync } from '../sync/autoSync';
import { api, restoreSession, setAuthExpiredHandler } from '../network/api';
import { readCachedUser, saveCachedUser } from '../security/secureTokens';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const updateProfile = useCallback(async (patch: { province?: string; jobRole?: string }) => {
    const response = await api.patch('/users/me', patch);
    const updated = response.data?.data?.user as AuthUser;
    if (updated) {
      const refreshed = await restoreSession();
      const current = (refreshed?.user as AuthUser | undefined) ?? updated;
      setUser(current);
      setSessionAuthenticated(Boolean(refreshed));
      await saveCachedUser(current);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await performLogout(); }
    finally {
      setUser(null);
      setSessionAuthenticated(false);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, updateProfile }), [user, loading, login, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
