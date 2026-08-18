/**
 * Field chrome — owned by A. Kit-internal, not exported from index.js.
 *
 * The label / hint / error block every form control repeats. One copy, so the
 * aria wiring cannot drift between them.
 */

import { useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * Ids and the aria-describedby join. A hook rather than part of the shell
 * because the id has to land on the control, which the shell does not render.
 *
 * @param {{ hint?: string, error?: string }} props
 */
export function useFieldIds({ hint, error }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return {
    id,
    hintId,
    errorId,
    // Screen readers get the hint and the error read out with the control.
    describedBy: cn(hint && hintId, error && errorId).trim() || undefined,
  };
}

/**
 * Wrapper, label, hint and error around a control.
 *
 * Omit `label` and the shell renders no label at all — FormCheckbox needs its
 * own, sitting beside the box rather than above it.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} props.id from useFieldIds
 * @param {string} props.hintId
 * @param {string} props.errorId
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 */
export function FieldShell({
  label,
  id,
  hintId,
  errorId,
  required = false,
  hint,
  error,
  className,
  children,
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children}

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
}
