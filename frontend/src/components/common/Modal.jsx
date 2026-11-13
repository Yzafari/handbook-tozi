import {
  useCallback,
  useEffect,
  useId,
  useRef
} from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  confirmVariant = false,
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  onConfirm,
  confirmLoading = false,
  closeOnOverlay = true,
  showCloseButton = true,
  className = ''
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = useCallback(() => {
    if (!confirmLoading) onClose?.();
  }, [confirmLoading, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;

    const focusFirst = () => {
      const focusable = dialog?.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable?.length) {
        focusable[0].focus();
      } else {
        dialog?.focus();
      }
    };

    const frame = window.requestAnimationFrame(focusFirst);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);

      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, close]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={[
          'my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl',
          'outline-none dark:border-slate-700 dark:bg-slate-900',
          className
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          {confirmVariant && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>

            {description && (
              <p
                id={descriptionId}
                className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
              >
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={close}
              disabled={confirmLoading}
              aria-label="بستن پنجره"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>

        {children && <div className="mt-5">{children}</div>}

        {confirmVariant && (
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={close}
              disabled={confirmLoading}
            >
              {cancelText}
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              loading={confirmLoading}
            >
              {confirmText}
            </Button>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}

export default Modal;