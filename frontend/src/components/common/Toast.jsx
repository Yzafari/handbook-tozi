import React, { useEffect } from 'react';

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div 
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg transition-all duration-300 ${typeStyles[type]}`} 
      dir="rtl"
    >
      <span className="text-lg">{icons[type]}</span>
      <p className="text-sm font-medium">{message}</p>
      {onClose && (
        <button 
          onClick={onClose} 
          className="mr-auto text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;