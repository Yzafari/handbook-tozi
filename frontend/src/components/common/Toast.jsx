import React, { useEffect, useRef } from 'react';

const DEFAULT_TYPE = 'info';
const DEFAULT_DURATION = 3000;

const TYPE_STYLES = {
  success:
    'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
  error:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
  warning:
    'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800',
  info:
    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
};

const TYPE_ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const hasType = (type) => Object.prototype.hasOwnProperty.call(TYPE_STYLES, type);

export const Toast = ({
  message,
  type = DEFAULT_TYPE,
  onClose,
  duration = DEFAULT_DURATION,
}) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!duration || duration <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (typeof onCloseRef.current === 'function') {
        onCloseRef.current();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const resolvedType = hasType(type) ? type : DEFAULT_TYPE;

  return (
    <div
      role={resolvedType === 'error' ? 'alert' : 'status'}
      dir="rtl"
      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ${TYPE_STYLES[resolvedType]}`}
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {TYPE_ICONS[resolvedType]}
      </span>
      <p className="flex-1 break-words text-sm font-medium">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن"
          className="shrink-0 text-xl leading-none text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;
