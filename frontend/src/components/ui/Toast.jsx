import React, { useEffect } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const types = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
  };

  return (
    <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center justify-between gap-4 transition-all ${types[type]}`}>
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-white/80 hover:text-white font-bold">
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;