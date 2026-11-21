import React, { forwardRef, useId } from 'react';

/**
 * Single shared text input for the whole app.
 *
 * The label is associated with the control through `htmlFor`/`id` so screen
 * readers and testing-library can resolve `getByLabelText`, and validation
 * errors are announced through `aria-invalid` + `aria-describedby`.
 */
const Input = forwardRef(function Input(
  { label, error, id, hint, className = '', wrapperClassName = '', required = false, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const errorMessage = typeof error === 'string' ? error : error?.message;

  const describedBy =
    [errorMessage ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {required && (
            <span className="ms-1 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          errorMessage ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {hint && !errorMessage && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {errorMessage && (
        <p id={errorId} role="alert" className="text-xs text-red-500">
          {errorMessage}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
