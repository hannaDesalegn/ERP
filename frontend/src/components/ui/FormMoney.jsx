/**
 * Money input — owned by A.
 *
 * Integer minor units in, integer minor units out, never a float.
 * docs/entities.md § Money is an integer.
 */

import { forwardRef, useEffect, useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { formatMoney, parseMoney } from '@/lib/format';

/** Minor units → the plain digits a user edits: 149900 → "1499.00". */
function toEditable(minorUnits, currency) {
  if (minorUnits === null || minorUnits === undefined) return '';
  return formatMoney(minorUnits, currency, { showCurrency: false }).replace(
    /,/g,
    '',
  );
}

/**
 * **Use with `Controller`, never `register`.** `onChange` emits a number, not
 * an event, so `register`'s event-based handler cannot consume it:
 *
 *     <Controller
 *       name="creditLimit"
 *       control={control}
 *       render={({ field }) => <FormMoney {...field} label="Credit limit" />}
 *     />
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {number|null} [props.value] integer, minor units
 * @param {string} [props.currency] ISO 4217 — also decides the decimal places
 * @param {(minorUnits: number|null) => void} [props.onChange] integer out
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 */
export const FormMoney = forwardRef(function FormMoney(
  {
    label,
    name,
    value = null,
    currency = 'ETB',
    onChange,
    onBlur,
    error,
    required = false,
    hint,
    disabled = false,
    placeholder,
    className,
    ...rest
  },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cn(hint && hintId, error && errorId).trim() || undefined;

  // What the user sees while typing. "1499." is a valid keystroke and must
  // survive, so the text is not re-derived from `value` on every change.
  const [text, setText] = useState(() => toEditable(value, currency));
  const [editing, setEditing] = useState(false);

  // Re-seed from outside — a form reset, a server patch — but never mid-typing.
  // Also fires on blur, which is what normalises "1499" to "1499.00".
  useEffect(() => {
    if (editing) return;
    setText(toEditable(value, currency));
  }, [value, currency, editing]);

  const handleChange = (event) => {
    setText(event.target.value);
    onChange?.(parseMoney(event.target.value, currency));
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {/* ISO 4217 codes are always three letters, so the left pad is stable. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted"
        >
          {String(currency).toUpperCase()}
        </span>

        {/* type="text", not number: a number input allows "e" and fights the
            decimal formatting. inputMode gets the numeric keypad anyway. */}
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          onFocus={() => setEditing(true)}
          onBlur={(event) => {
            setEditing(false);
            onBlur?.(event);
          }}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full rounded-md border bg-surface py-1.5 pl-12 pr-2.5 text-sm text-text',
            'text-right tabular-nums placeholder:text-text-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-danger' : 'border-border',
          )}
          {...rest}
        />
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
