import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RegisterForm from '../components/auth/RegisterForm';

export default function Register() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-900 via-brand-700 to-brand-600 p-12 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_80%_20%,white,transparent_35%),radial-gradient(circle_at_20%_70%,white,transparent_35%)]" />
        <div className="relative">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            GetHub
          </Link>
          <p className="mt-3 max-w-sm text-brand-100">
            چند ثانیه تا دسترسی به همه امکانات فاصله دارید.
          </p>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-extrabold leading-tight">
            ساخت حساب کاربری جدید
          </h1>
          <ul className="space-y-2 text-brand-100 text-sm">
            <li>✓ ثبت‌نام رایگان و سریع</li>
            <li>✓ انتخاب پلن مناسب در هر زمان</li>
            <li>✓ یادآوری خودکار انقضای اشتراک</li>
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
            <h2 className="mt-2 text-2xl font-bold text-gray-900">ثبت‌نام</h2>
            <p className="mt-1 text-sm text-gray-500">
              اطلاعات خود را وارد کنید تا حساب کاربری‌تان ساخته شود.
            </p>
          </div>

          <RegisterForm />
        </div>
      </div>
    </div>
  );
}