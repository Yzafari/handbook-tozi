import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '../../utils/schemas';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';

const LOCKED_MESSAGE =
  'حساب شما به دلیل تلاش‌های ناموفق متعدد موقتاً قفل شده است. لطفاً پس از ۱۵ دقیقه دوباره تلاش کنید.';

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [toast, setToast] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const user = await login(values.email, values.password);
      setToast({ type: 'success', message: 'خوش آمدید! ورود با موفقیت انجام شد.' });
      const role = user?.role;
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'ACCOUNT_LOCKED') {
        setServerError(LOCKED_MESSAGE);
      } else {
        setServerError(getErrorMessage(err));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <Input
        id="email"
        type="email"
        label="ایمیل"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <div className="relative">
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          label="رمز عبور"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute left-3 top-9 text-xs font-medium text-brand-600 hover:text-brand-700"
          aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
        >
          {showPassword ? 'پنهان' : 'نمایش'}
        </button>
      </div>

      <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
        ورود
      </Button>

      <p className="text-center text-sm text-gray-600">
        حساب کاربری ندارید؟{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          ثبت‌نام کنید
        </Link>
      </p>
    </form>
  );
}
