import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = forwardRef(function Input(
  {
    label,
    error,
    id,
    name,
    type = 'text',
    hint,
    className = '',
    wrapperClassName = '',
    required = false,
    disabled = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const isPassword = type === 'password';
  const [passwordVisible, setPasswordVisible] = useState(false);
  const effectiveType = isPassword && passwordVisible ? 'text' : type;

  const describedBy = [
    error ? errorId : null,
    hint ? hintId : null
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`w-full space-y-1.5 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
          {required && (
            <span className="ms-1 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={effectiveType}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={[
            'block w-full rounded-xl border bg-white px-3 py-2.5 text-start text-sm',
            'text-slate-900 placeholder:text-slate-400',
            'transition duration-200',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/30',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70',
            'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-slate-200 focus:border-violet-500 dark:border-slate-700',
            isPassword ? 'pe-11' : '',
            className
          ].join(' ')}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute inset-y-0 end-0 inline-flex items-center px-3 text-slate-500 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
            aria-label={
              passwordVisible ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'
            }
            aria-pressed={passwordVisible}
            tabIndex={0}
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {typeof error === 'string' ? error : error.message}
        </p>
      )}
    </div>
  );
});