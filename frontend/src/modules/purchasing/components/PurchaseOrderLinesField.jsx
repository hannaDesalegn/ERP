/**
 * Purchase order line editor — C owns this file.
 *
 * The hardest form in the operations set: a variable-length array of lines, each
 * with a product picker, quantity, unit price and two percentages.
 *
 * The totals shown here are an OPTIMISTIC PREVIEW ONLY. The server calculates
 * every money value and the form never sends one
 * (docs/entities.md § SalesOrder, docs/security-notes.md §2). If this preview
 * and the saved order ever disagree, the server is right.
 */

import { Plus, Trash } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';

import { Button, FormSelect } from '@/components/ui';
import { formatMoney } from '@/lib/format';

import { calculateLineTotal, calculateTotals } from '../mock';
import { purchaseOrderLineDefaults } from '../schema';
import { PurchaseOrderMoneyField } from './PurchaseOrderMoneyField';

/**
 * @param {object} props
 * @param {import('react-hook-form').Control} props.control
 * @param {Function} props.register
 * @param {object} props.errors
 * @param {Function} props.watch
 * @param {Function} props.setValue
 * @param {{ value: string, label: string, costPrice: number }[]} props.productOptions
 * @param {boolean} [props.productsLoading]
 * @param {string} props.currency
 */
export function PurchaseOrderLinesField({
  control,
  register,
  errors,
  watch,
  setValue,
  productOptions,
  productsLoading = false,
  currency,
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  // Watching the whole array is what makes the preview live. It re-renders on
  // every keystroke, which is fine for the handful of lines a PO carries.
  const lines = watch('lines') ?? [];
  const totals = calculateTotals(
    lines.map((line) => ({
      unitPrice: line?.unitPrice ?? 0,
      quantity: line?.quantity ?? 0,
      discountPercent: line?.discountPercent ?? 0,
      taxPercent: line?.taxPercent ?? 0,
    })),
  );

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-semibold text-text">Lines</legend>

      {/* The array-level error: "Add at least one line before saving." */}
      {typeof errors.lines?.message === 'string' && (
        <p role="alert" className="text-xs text-danger">
          {errors.lines.message}
        </p>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-text-muted">
          No lines yet. Add the first one to start pricing this order.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const line = lines[index] ?? {};
          const lineErrors = errors.lines?.[index] ?? {};
          const preview = calculateLineTotal({
            unitPrice: line.unitPrice ?? 0,
            quantity: line.quantity ?? 0,
            discountPercent: line.discountPercent ?? 0,
          });

          return (
            <li
              key={field.id}
              className="flex flex-col gap-3 rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-text-muted">
                  Line {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash}
                  onClick={() => remove(index)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  Remove
                </Button>
              </div>

              <Controller
                name={`lines.${index}.productId`}
                control={control}
                render={({ field: productField }) => (
                  <FormSelect
                    label="Product"
                    name={productField.name}
                    value={productField.value ?? ''}
                    onChange={(event) => {
                      productField.onChange(event);
                      // Prefill the unit price from the product's cost price —
                      // what we pay the supplier. The user can override it,
                      // because a supplier quote is not always the stored cost.
                      const chosen = productOptions.find(
                        (option) => option.value === event.target.value,
                      );
                      if (chosen) {
                        setValue(`lines.${index}.unitPrice`, chosen.costPrice, {
                          shouldValidate: true,
                        });
                      }
                    }}
                    options={productOptions}
                    loading={productsLoading}
                    error={lineErrors.productId?.message}
                    required
                    searchable
                  />
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text">
                    Quantity
                    <span className="ml-0.5 text-danger" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={inputClasses(lineErrors.quantity)}
                    aria-invalid={lineErrors.quantity ? true : undefined}
                    {...register(`lines.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  {lineErrors.quantity && (
                    <span role="alert" className="text-xs text-danger">
                      {lineErrors.quantity.message}
                    </span>
                  )}
                </label>

                <Controller
                  name={`lines.${index}.unitPrice`}
                  control={control}
                  render={({ field: priceField }) => (
                    <PurchaseOrderMoneyField
                      label="Unit price"
                      name={priceField.name}
                      value={priceField.value}
                      currency={currency}
                      onChange={priceField.onChange}
                      error={lineErrors.unitPrice?.message}
                      required
                    />
                  )}
                />

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text">
                    Discount %
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    className={inputClasses(lineErrors.discountPercent)}
                    aria-invalid={lineErrors.discountPercent ? true : undefined}
                    {...register(`lines.${index}.discountPercent`, {
                      valueAsNumber: true,
                    })}
                  />
                  {lineErrors.discountPercent && (
                    <span role="alert" className="text-xs text-danger">
                      {lineErrors.discountPercent.message}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text">Tax %</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    className={inputClasses(lineErrors.taxPercent)}
                    aria-invalid={lineErrors.taxPercent ? true : undefined}
                    {...register(`lines.${index}.taxPercent`, {
                      valueAsNumber: true,
                    })}
                  />
                  {lineErrors.taxPercent && (
                    <span role="alert" className="text-xs text-danger">
                      {lineErrors.taxPercent.message}
                    </span>
                  )}
                </label>
              </div>

              <p className="text-right text-sm text-text-muted">
                Line total (before tax):{' '}
                <span className="font-mono text-text">
                  {formatMoney(preview, currency)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() => append(purchaseOrderLineDefaults)}
        >
          Add line
        </Button>
      </div>

      <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <Total label="Subtotal" value={totals.subtotal} currency={currency} />
        <Total label="Tax" value={totals.taxTotal} currency={currency} />
        <Total
          label="Grand total"
          value={totals.grandTotal}
          currency={currency}
          emphasis
        />
        <p className="mt-1 text-xs text-text-muted">
          Preview only. The server calculates the final totals when you save.
        </p>
      </dl>
    </fieldset>
  );
}

function Total({ label, value, currency, emphasis = false }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={emphasis ? 'font-medium text-text' : 'text-text-muted'}>
        {label}
      </dt>
      <dd
        className={
          emphasis ? 'font-mono font-medium text-text' : 'font-mono text-text'
        }
      >
        {formatMoney(value, currency)}
      </dd>
    </div>
  );
}

function inputClasses(error) {
  return [
    'w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm text-text',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    error ? 'border-danger' : 'border-border',
  ].join(' ');
}
