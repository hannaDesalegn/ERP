/**
 * Checkbox — owned by A.
 *
 * Works with register (RHF reads event.target.checked) or with Controller.
 */

import { forwardRef, useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {boolean} [props.checked]
 * @param {(event: React.ChangeEvent) => void} [props.onChange]
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {boolean} [props.disabled]
 */
export const FormCheckbox = forwardRef(function FormCheckbox(
  {
    label,
    name,
    checked,
    onChange,
    error,
    hint,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cn(hint && hintId, error && errorId).trim() || undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Label beside the box, not above it — the other fields stack, a
          checkbox reads as one line. */}
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-4 w-4 shrink-0 rounded-sm accent-[color:var(--color-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-danger' : 'border-border',
          )}
          {...rest}
        />
        <label htmlFor={id} className="text-sm text-text">
          {label}
        </label>
      </div>

      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
