import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';

const variants = {
  primary:
    'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-sm hover:from-violet-700 hover:to-blue-700',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-700'
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2',
        'text-sm font-semibold transition duration-200 ease-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:focus-visible:ring-offset-slate-900',
        variants[variant] ?? variants.primary,
        className
      ].join(' ')}
      {...props}
    >
      {loading && (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin"
        />
      )}
      {children}
    </button>
  );
});

export default Button;