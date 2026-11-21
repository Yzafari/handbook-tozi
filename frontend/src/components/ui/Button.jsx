import React, { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';

/**
 * The only Button implementation in the app (the duplicated
 * `components/common/Button.jsx` was removed to stop the two variants from
 * drifting apart).
 */
const Button = forwardRef(function Button(
  { children, variant = 'primary', className = '', loading = false, ...props },
  ref
) {
  const baseStyle =
    'px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 shadow-sm',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus-visible:ring-gray-400',
    outline:
      'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
  };

  return (
    <button
      ref={ref}
      className={`${baseStyle} ${variants[variant] ?? variants.primary} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {loading ? 'در حال پردازش...' : children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
