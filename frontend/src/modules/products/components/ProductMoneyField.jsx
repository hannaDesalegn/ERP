/**
 * Money input — C owns this file.
 *
 * ── TEMPORARY ────────────────────────────────────────────────────────────────
 * docs/components.md specifies a shared `FormMoney` in the kit, and it is not
 * built yet (see the "Still to come" list in components/ui/index.js). The docs
 * also say never to wire a plain `FormField type="number"` to a money field,
 * which leaves nothing to build the product form with.
 *
 * So this is a module-local stand-in with the SAME contract as the specified
 * FormMoney: integer minor units in, integer minor units out. When A ships the
 * real one, delete this file and swap the import — no other change needed.
 * Requested from A; not a fork of an existing component, because there is no
 * existing component to fork.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';

import { FormField } from '@/components/ui';
import { formatMoney, parseMoney } from '@/lib/format';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {number|null} props.value integer, minor units
 * @param {string} [props.currency] ISO 4217 — decides the decimal places
 * @param {(minorUnits: number|null) => void} props.onChange integer, minor units
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {boolean} [props.disabled]
 */
export function ProductMoneyField({
  label,
  name,
  value,
  currency = 'ETB',
  onChange,
  error,
  required = false,
  hint,
  disabled = false,
}) {
  // The user types a major-unit string ("1,499.00"); the form holds an integer
  // in minor units (149900). Keeping a local draft means a half-typed "1499."
  // is not destroyed by a reformat on every keystroke.
  const [draft, setDraft] = useState(() => toDisplay(value, currency));
  const [focused, setFocused] = useState(false);

  // Re-sync when the form resets or loads a record, but never while the user is
  // mid-edit — that would rewrite what they are typing under the cursor.
  useEffect(() => {
    if (!focused) setDraft(toDisplay(value, currency));
  }, [value, currency, focused]);

  return (
    <FormField
      label={label}
      name={name}
      type="text"
      inputMode="decimal"
      value={draft}
      error={error}
      required={required}
      hint={hint}
      disabled={disabled}
      placeholder="0.00"
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        // parseMoney rounds half away from zero rather than truncating —
        // truncating loses a cent on every line.
        onChange(parseMoney(next, currency));
      }}
      onBlur={() => {
        setFocused(false);
        setDraft(toDisplay(value, currency));
      }}
    />
  );
}

/** Integer minor units → the plain number a user edits. No currency code. */
function toDisplay(minorUnits, currency) {
  if (minorUnits === null || minorUnits === undefined) return '';
  return formatMoney(minorUnits, currency, { showCurrency: false });
}
