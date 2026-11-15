import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

import { api, setAccessToken } from '../utils/api';
import { fetchCsrfToken, refreshSession, logout as logoutSession } from '../services/auth.service';

export const AuthContext = createContext(null);

function extractUser(response) {
  const data = response?.data?.data;
  const user = data?.user ?? data;

  if (
    !user ||
    typeof user !== 'object' ||
    !user.id ||
    !user.email ||
    !user.role
  ) {
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
        // مرحله 1: درخواست تمدید نشست
        const csrf = await fetchCsrfToken();
        const responseData = await refreshSession(csrf.csrfToken);

        // مرحله 2: استخراج امن توکن (سازگار با هر دو کلید token و accessToken)
        const token = responseData?.token || responseData?.accessToken;

        // مرحله 3: بررسی معتبر بودن توکن دریافتی
        if (!token) {
          throw new Error('Access Token دریافت نشد.');
        }

        // مرحله 4: استخراج اطلاعات کاربر
        const currentUser = responseData?.user;
        if (!currentUser?.id || !currentUser?.email || !currentUser?.role) throw new Error('اطلاعات کاربر از سرور دریافت نشد یا ناقص است.');

        // مرحله 5: بررسی فعال بودن کامپوننت
        if (!mounted || authVersion.current !== currentVersion) {
          return;
        }

        // مرحله 6: ذخیره توکن در هدرهای پیش‌فرض Axios
        setAccessToken(token);

        // مرحله 7: تنظیم کاربر
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
    const token = response?.data?.data?.token;

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

  const logout = async () => {
    try {
      const csrf = await fetchCsrfToken();
      await logoutSession(csrf.csrfToken);
    } finally {
      authVersion.current += 1;
      setUser(null);
      setAccessToken(null);
    }
  };

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
