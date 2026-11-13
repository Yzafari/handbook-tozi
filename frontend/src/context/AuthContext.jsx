import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

import { api } from '../utils/api';

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
    let mounted = true;
    const currentVersion = authVersion.current;

    const checkAuth = async () => {
      try {
        // مرحله 1: درخواست تمدید نشست
        const response = await api.post('/auth/refresh');

        // مرحله 2: استخراج امن توکن (سازگار با هر دو کلید token و accessToken)
        const responseData = response?.data?.data;
        const token = responseData?.token || responseData?.accessToken;

        // مرحله 3: بررسی معتبر بودن توکن دریافتی
        if (!token) {
          throw new Error('Access Token دریافت نشد.');
        }

        // مرحله 4: استخراج اطلاعات کاربر
        const currentUser = extractUser(response);

        // مرحله 5: بررسی فعال بودن کامپوننت
        if (!mounted || authVersion.current !== currentVersion) {
          return;
        }

        // مرحله 6: ذخیره توکن در هدرهای پیش‌فرض Axios
        api.defaults.headers.common.Authorization = `Bearer ${token}`;

        // مرحله 7: تنظیم کاربر
        setUser(currentUser);

      } catch (error) {
        // اگر رفرش ناموفق بود (یا کاربر لاگین نبود)، نشست پاک می‌شود
        if (mounted && authVersion.current === currentVersion) {
          setUser(null);
          delete api.defaults.headers.common.Authorization;
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

    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    setUser(currentUser);
    setLoading(false);

    return currentUser;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const currentUser = extractUser(response);

    authVersion.current += 1;
    setUser(currentUser);
    setLoading(false);

    return currentUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      authVersion.current += 1;
      setUser(null);
      delete api.defaults.headers.common.Authorization;
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
