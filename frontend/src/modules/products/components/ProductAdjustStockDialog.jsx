/**
 * Adjust stock — C owns this file.
 *
 * Stock is never edited by typing a new quantityOnHand. It changes only through
 * an adjustment record, so there is always an audit trail (docs/entities.md
 * § Product). That requirement is why this dialog exists instead of an editable
 * quantity field on the form.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, FormField, FormSelect, Modal, toast } from '@/components/ui';
import { formatNumber } from '@/lib/format';

import { createProductAdjustment, productKeys } from '../api';
import { stockAdjustmentDefaults, stockAdjustmentSchema } from '../schema';

const DIRECTION_OPTIONS = [
  { value: 'increase', label: 'Increase — stock coming in' },
  { value: 'decrease', label: 'Decrease — stock going out' },
];

const REASON_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'damage', label: 'Damage' },
  { value: 'loss', label: 'Loss' },
  { value: 'count_correction', label: 'Count correction' },
  { value: 'return', label: 'Return' },
];

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} props.product the product being adjusted
 */
export function ProductAdjustStockDialog({ open, onClose, product }) {
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: stockAdjustmentDefaults,
  });

  // Fresh form every time the dialog opens, so yesterday's reason is not
  // pre-filled on today's adjustment.
  useEffect(() => {
    if (open) reset(stockAdjustmentDefaults);
  }, [open, reset]);

  const direction = watch('direction');
  const quantity = watch('quantity');

  const mutation = useMutation({
    mutationFn: (body) => createProductAdjustment(product.id, body),
    onSuccess: () => {
      // The product's quantityOnHand changed server-side, so both the record
      // and its history are stale.
      queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) });
      queryClient.invalidateQueries({ queryKey: productKeys.adjustments(product.id) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Same verb as the button that caused it — docs/components.md § toasts.
      toast.success('Stock adjusted');
      onClose();
    },
    onError: (error) => {
      // 422 carries `fields`, which maps straight onto the inputs.
      if (error.fields) {
        Object.entries(error.fields).forEach(([field, message]) =>
          setError(field, { message }),
        );
        return;
      }
      // 409 here means the decrease would take stock negative. It is not a
      // field error, so it belongs on the quantity input as the nearest cause.
      if (error.code === 'CONFLICT') {
        setError('quantity', { message: error.message });
        return;
      }
      toast.error('Could not adjust stock', { description: error.message });
    },
  });

  const projected =
    product && Number.isFinite(quantity)
      ? product.quantityOnHand +
        (direction === 'increase' ? quantity : -quantity)
      : null;

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description={`${product.sku} — ${product.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((values) => mutation.mutate(values))}
            loading={mutation.isPending}
          >
            Adjust stock
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-text-muted">
          On hand now:{' '}
          <span className="font-mono text-text">
            {formatNumber(product.quantityOnHand, {
              unit: product.unitOfMeasure,
            })}
          </span>
          {projected !== null && projected !== product.quantityOnHand && (
            <>
              {' → after this adjustment: '}
              <span className="font-mono text-text">
                {formatNumber(projected, { unit: product.unitOfMeasure })}
              </span>
            </>
          )}
        </p>

        <Controller
          name="direction"
          control={control}
          render={({ field }) => (
            <FormSelect
              label="Direction"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              options={DIRECTION_OPTIONS}
              error={errors.direction?.message}
              required
            />
          )}
        />

        <FormField
          label="Quantity"
          type="number"
          step="any"
          min="0"
          required
          error={errors.quantity?.message}
          hint={`In ${product.unitOfMeasure}. Decimals are allowed.`}
          {...register('quantity', { valueAsNumber: true })}
        />

        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <FormSelect
              label="Reason"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              options={REASON_OPTIONS}
              error={errors.reason?.message}
              required
            />
          )}
        />

        <FormField
          label="Reference"
          error={errors.reference?.message}
          hint="Optional — a PO or order number, e.g. PO-2026-0031."
          {...register('reference', {
            // Missing values are null, never "" (docs/entities.md).
            setValueAs: (value) => (value === '' ? null : value),
          })}
        />

        <FormField
          label="Notes"
          type="textarea"
          rows={3}
          error={errors.notes?.message}
          {...register('notes', {
            setValueAs: (value) => (value === '' ? null : value),
          })}
        />
      </form>
    </Modal>
  );
}
