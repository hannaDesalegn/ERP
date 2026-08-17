import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

import { FieldShell, useFieldIds } from './FieldShell';

/**
 * Text-ish form input with label, hint and error.
 *
 * Works uncontrolled with React Hook Form's `register` (props are spread onto
 * the element and the ref is forwarded) or controlled via `Controller`.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {'text'|'email'|'password'|'number'|'textarea'|'date'|'tel'} [props.type]
 * @param {string|number} [props.value]
 * @param {(event: React.ChangeEvent) => void} [props.onChange]
 * @param {string} [props.error] message from Zod or the server's `fields`
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 */
export const FormField = forwardRef(function FormField(
  {
    label,
    name,
    type = 'text',
    value,
    onChange,
    error,
    required = false,
    hint,
    disabled = false,
    placeholder,
    rows = 4,
    className,
    ...rest
  },
  ref,
) {
  const { id, hintId, errorId, describedBy } = useFieldIds({ hint, error });

  const fieldClasses = cn(
    'w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm text-text',
    'placeholder:text-text-muted',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:opacity-60',
    error ? 'border-danger' : 'border-border',
  );

  const shared = {
    id,
    name,
    value,
    onChange,
    disabled,
    placeholder,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: fieldClasses,
    ...rest,
  };

  return (
    <FieldShell
      label={label}
      id={id}
      hintId={hintId}
      errorId={errorId}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      {type === 'textarea' ? (
        <textarea ref={ref} rows={rows} {...shared} />
      ) : (
        <input ref={ref} type={type} {...shared} />
      )}
    </FieldShell>
  );
});
