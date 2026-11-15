import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import Toast from '../components/ui/Toast';

export const ToastContext = createContext(null);

export const TOAST_TYPES = Object.freeze(['success', 'error', 'warning', 'info']);

const DEFAULT_TYPE = 'info';
const DEFAULT_DURATION = 3000;

let toastSequence = 0;

const createToastId = () => {
  toastSequence += 1;
  return `toast-${Date.now()}-${toastSequence}`;
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !React.isValidElement(value);

const normalizeType = (type) => (TOAST_TYPES.includes(type) ? type : DEFAULT_TYPE);

const normalizeOptions = (options) => {
  if (typeof options === 'number' && Number.isFinite(options)) {
    return { duration: options };
  }
  if (isPlainObject(options)) {
    return options;
  }
  return {};
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((messageOrOptions, type = DEFAULT_TYPE, options) => {
    let message = messageOrOptions;
    let resolvedType = type;
    let resolvedOptions = normalizeOptions(options);

    if (isPlainObject(messageOrOptions)) {
      const { message: nestedMessage, type: nestedType, duration, ...rest } = messageOrOptions;
      message = nestedMessage;
      resolvedType = nestedType ?? DEFAULT_TYPE;
      resolvedOptions = { ...rest, ...(duration !== undefined ? { duration } : {}) };
    }

    if (message === undefined || message === null || message === '') {
      return null;
    }

    const duration = Number.isFinite(resolvedOptions.duration)
      ? resolvedOptions.duration
      : DEFAULT_DURATION;

    const id = createToastId();

    setToasts((prev) => [
      ...prev,
      { id, message, type: normalizeType(resolvedType), duration },
    ]);

    return id;
  }, []);

  const success = useCallback(
    (message, options) => showToast(message, 'success', options),
    [showToast],
  );

  const error = useCallback(
    (message, options) => showToast(message, 'error', options),
    [showToast],
  );

  const warning = useCallback(
    (message, options) => showToast(message, 'warning', options),
    [showToast],
  );

  const info = useCallback(
    (message, options) => showToast(message, 'info', options),
    [showToast],
  );

  const value = useMemo(
    () => ({ showToast, removeToast, success, error, warning, info }),
    [showToast, removeToast, success, error, warning, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      'useToast must be used within a ToastProvider (useToast باید داخل ToastProvider استفاده شود).',
    );
  }

  return context;
}

export default ToastProvider;
