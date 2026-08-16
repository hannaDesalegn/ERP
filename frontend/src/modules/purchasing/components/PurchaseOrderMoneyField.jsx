/**
 * Money input — C owns this file.
 *
 * ── TEMPORARY ────────────────────────────────────────────────────────────────
 * Same stand-in as modules/products/components/ProductMoneyField.jsx, for the
 * same reason: docs/components.md specifies a shared `FormMoney` in the kit and
 * it is not built yet, while the same doc forbids wiring a plain
 * `FormField type="number"` to a money field.
 *
 * Duplicated rather than imported across module folders, per the README rule
 * that modules do not reach into each other. Both copies have the same contract
 * as the specified FormMoney — integer minor units in, integer minor units out
 * — so when A ships it, delete both files and swap the imports.
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
export function PurchaseOrderMoneyField({
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
  // in minor units (149900). A local draft means a half-typed "1499." survives
  // the next keystroke instead of being reformatted out from under the cursor.
  const [draft, setDraft] = useState(() => toDisplay(value, currency));
  const [focused, setFocused] = useState(false);

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
        // parseMoney rounds half away from zero rather than truncating.
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
