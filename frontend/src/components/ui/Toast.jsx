import React, { useEffect, useRef } from 'react';

const TYPE_STYLES = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-500 text-white',
};

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  const onCloseRef = useRef(onClose);

  // Keep the latest callback without restarting the auto-dismiss timer.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!duration || duration <= 0) return undefined;
    const timer = setTimeout(() => {
      if (typeof onCloseRef.current === 'function') onCloseRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const resolvedType = TYPE_STYLES[type] ? type : 'info';

  return (
    <div
      role={resolvedType === 'error' ? 'alert' : 'status'}
      dir="rtl"
      className={`fixed bottom-5 left-5 z-50 flex items-center justify-between gap-4 rounded-lg px-6 py-3 shadow-lg transition-all ${TYPE_STYLES[resolvedType]}`}
    >
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پیام"
          className="font-bold text-white/80 hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;
