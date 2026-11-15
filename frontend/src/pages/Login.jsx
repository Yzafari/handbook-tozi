import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import Toast from '../components/ui/Toast';

export default function Login() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(location.state?.toast || null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, user, navigate, location.state]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-12 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_35%)]" />
        <div className="relative">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            GetHub
          </Link>
          <p className="mt-3 max-w-sm text-brand-100">
            پلتفرم مدیریت اشتراک‌ها؛ ساده، امن و سریع.
          </p>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-extrabold leading-tight">
            به حساب کاربری خود وارد شوید
          </h1>
          <ul className="space-y-2 text-brand-100 text-sm">
            <li>✓ مدیریت آسان اشتراک و پرداخت‌ها</li>
            <li>✓ امنیت بالا با احراز هویت دو لایه</li>
            <li>✓ پشتیبانی از درگاه پرداخت زرین‌پال</li>
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">
          © {new Date().getFullYear()} GetHub — تمامی حقوق محفوظ است.
        </p>
      </div>

      <div className="flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
          <div className="mb-6 text-center lg:text-right">
            <Link to="/" className="text-xl font-bold text-brand-600 lg:hidden">
              GetHub
            </Link>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">ورود به حساب</h2>
            <p className="mt-1 text-sm text-gray-500">
              برای ادامه، اطلاعات حساب خود را وارد کنید.
            </p>
          </div>

          {toast && (
            <div className="mb-4">
              <Toast
                type={toast.type}
                message={toast.message}
                onClose={() => setToast(null)}
              />
            </div>
          )}

          <LoginForm />
        </div>
      </div>
    </div>
  );
}