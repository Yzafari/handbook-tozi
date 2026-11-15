import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext.jsx';

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast باید داخل ToastProvider استفاده شود.');
  }

  return context;
}

export default useToast;