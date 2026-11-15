import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

import { api, setAccessToken, refreshSession, ensureCsrfToken } from '../utils/api';
import { logout as logoutSession } from '../services/auth.service';

export const AuthContext = createContext(null);

const isValidUser = (user) =>
  Boolean(
    user &&
      typeof user === 'object' &&
      user.id &&
      user.email &&
      user.role,
  );

function extractUser(response) {
  const data = response?.data?.data;
  const user = data?.user ?? data;

  if (!isValidUser(user)) {
    throw new Error('اطلاعات کاربر از سرور دریافت نشد یا ناقص است.');
  }

  return user;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // مانع از آن می‌شود که پاسخ قدیمی بررسی نشست،
  // نتیجه ورود یا خروج جدید را بازنویسی کند.
  const authVersion = useRef(0);

  useEffect(() => {
    const handleForcedLogout = () => {
      authVersion.current += 1;
      setUser(null);
      setAccessToken(null);
      setLoading(false);
    };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  useEffect(() => {
    let mounted = true;
    const currentVersion = authVersion.current;

    const checkAuth = async () => {
      try {
        // مرحله 1: تمدید نشست با همان منطق مشترک utils/api.js
        // (CSRF + refresh + ذخیره توکن، همه در یک نقطه).
        const { user: refreshedUser } = await refreshSession();

        // مرحله 2: اگر پاسخ رفرش کاربر را برنگرداند، آن را از سرور می‌گیریم.
        let currentUser = refreshedUser;
        if (!isValidUser(currentUser)) {
          const response = await api.get('/users/me');
          const payload = response?.data?.data;
          currentUser = payload?.user ?? payload;
        }

        // مرحله 3: بررسی معتبر بودن اطلاعات کاربر
        if (!isValidUser(currentUser)) {
          throw new Error('اطلاعات کاربر از سرور دریافت نشد یا ناقص است.');
        }

        // مرحله 4: بررسی فعال بودن کامپوننت
        if (!mounted || authVersion.current !== currentVersion) {
          return;
        }

        // مرحله 5: تنظیم کاربر (توکن قبلاً توسط refreshSession ست شده است)
        setUser(currentUser);
      } catch (error) {
        // اگر رفرش ناموفق بود (یا کاربر لاگین نبود)، نشست پاک می‌شود
        if (mounted && authVersion.current === currentVersion) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (mounted && authVersion.current === currentVersion) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
    });

    const currentUser = extractUser(response);
    const token = response?.data?.data?.token || response?.data?.data?.accessToken;

    if (!token) {
      throw new Error('توکن ورود از سرور دریافت نشد.');
    }

    authVersion.current += 1;

    setAccessToken(token);

    setUser(currentUser);
    setLoading(false);

    return currentUser;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    // Registration creates the account but does not issue an access token.
    // Do not mark this user authenticated until the explicit login succeeds.
    return extractUser(response);
  };

  const logout = useCallback(async () => {
    try {
      const csrfToken = await ensureCsrfToken();
      await logoutSession(csrfToken);
    } catch (error) {
      // شکست شبکه یا CSRF نباید مانع پاک شدن نشست محلی شود.
    } finally {
      authVersion.current += 1;
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading: loading,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth باید داخل AuthProvider استفاده شود');
  }

  return context;
};
