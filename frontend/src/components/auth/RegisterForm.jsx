import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '../../utils/schemas';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/api';
import Button from '../ui/Button';
import Input from '../ui/Input';

const STRENGTH_LEVELS = [
  { label: 'بسیار ضعیف', color: 'bg-red-500', text: 'text-red-600' },
  { label: 'ضعیف', color: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'متوسط', color: 'bg-yellow-500', text: 'text-yellow-600' },
  { label: 'قوی', color: 'bg-green-500', text: 'text-green-600' },
];

export function getPasswordStrength(password = '') {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;
  return Math.min(score, 4);
}

function StrengthMeter({ password }) {
  const level = getPasswordStrength(password);
  const meta = STRENGTH_LEVELS[Math.max(level - 1, 0)];
  const active = level > 0;

  return (
    <div className="mt-1" data-testid="strength-meter">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= level ? meta.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs ${active ? meta.text : 'text-gray-400'}`}>
        {active ? `قدرت رمز عبور: ${meta.label}` : 'قدرت رمز عبور: —'}
      </p>
    </div>
  );
}

export default function RegisterForm() {
  // تغییر نام register از AuthContext به registerUser برای جلوگیری از تداخل
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    // تغییر نام register از useForm به registerField
    register: registerField,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password') || '';

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const payload = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
      };
      
      await registerUser(payload);
      
      navigate('/login', {
        replace: true,
        state: {
          toast: {
            type: 'success',
            message: 'ثبت‌نام با موفقیت انجام شد. حالا می‌توانید وارد شوید.',
          },
        },
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <Input
        id="fullName"
        label="نام و نام خانوادگی"
        placeholder="مثلا علی رضایی"
        autoComplete="name"
        error={errors.fullName?.message}
        {...registerField('fullName')}
      />

      <Input
        id="email"
        type="email"
        label="ایمیل"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...registerField('email')}
      />

      <Input
        id="phone"
        type="tel"
        label="شماره موبایل (اختیاری)"
        placeholder="09xxxxxxxxx"
        autoComplete="tel"
        error={errors.phone?.message}
        {...registerField('phone')}
      />

      <div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label="رمز عبور"
            placeholder="........"
            autoComplete="new-password"
            error={errors.password?.message}
            {...registerField('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute left-3 top-9 text-xs font-medium text-brand-600 hover:text-brand-700"
            aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
          >
            {showPassword ? 'مخفی' : 'نمایش'}
          </button>
        </div>
        <StrengthMeter password={password} />
      </div>

      <Input
        id="confirmPassword"
        type={showPassword ? 'text' : 'password'}
        label="تکرار رمز عبور"
        placeholder="........"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...registerField('confirmPassword')}
      />

      {/* Never disable submit on a weak password: the form must still show
          validation messages instead of silently doing nothing. */}
      <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
        ثبت‌نام
      </Button>

      <p className="text-center text-sm text-gray-600">
        قبلا ثبت‌نام کرده‌اید؟{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          وارد شوید
        </Link>
      </p>
    </form>
  );
}

export { StrengthMeter };
