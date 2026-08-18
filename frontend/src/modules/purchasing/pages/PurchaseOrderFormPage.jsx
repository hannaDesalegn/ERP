/**
 * Purchase order create / edit — C owns this file.
 *
 * Editing is only reachable while the order is a draft. The server enforces
 * that with a 409 (handlers.js § EDITABLE_STATUSES); this page just avoids
 * offering an edit that would be rejected.
 *
 * The form never sends a total or a status. Money is server-calculated and
 * status moves only through the POST actions on the detail page.
 *
 * RHF + the Zod resolver. Hand-rolled form state is banned in this repo
 * (docs/components.md § Forms).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  FormField,
  FormSelect,
  PageHeader,
  toast,
} from '@/components/ui';

import { PurchaseOrderLinesField } from '../components/PurchaseOrderLinesField';
import {
  createPurchaseOrder,
  fetchProductOptions,
  fetchPurchaseOrder,
  fetchSupplierOptions,
  purchaseOrderKeys,
  updatePurchaseOrder,
} from '../api';
import {
  purchaseOrderCreateSchema,
  purchaseOrderDefaults,
  purchaseOrderUpdateSchema,
} from '../schema';

/**
 * The fields this form owns. Totals, status, poNumber, supplierName, createdBy,
 * approvedBy and every line's quantityReceived are server-managed and
 * deliberately not here.
 */
function toFormValues(order) {
  return {
    supplierId: order.supplierId,
    orderDate: order.orderDate,
    expectedDate: order.expectedDate,
    currency: order.currency,
    notes: order.notes,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
    })),
  };
}

export function PurchaseOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: order, isLoading } = useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => fetchPurchaseOrder(id),
    enabled: isEdit,
  });

  const { data: supplierOptions = [], isLoading: suppliersLoading } = useQuery({
    queryKey: purchaseOrderKeys.supplierOptions(),
    queryFn: fetchSupplierOptions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: productOptions = [], isLoading: productsLoading } = useQuery({
    queryKey: purchaseOrderKeys.productOptions(),
    queryFn: fetchProductOptions,
    staleTime: 5 * 60 * 1000,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    // PATCH validates partially, POST validates the whole shape.
    resolver: zodResolver(
      isEdit ? purchaseOrderUpdateSchema : purchaseOrderCreateSchema,
    ),
    defaultValues: purchaseOrderDefaults,
  });

  // Populate once the record arrives — the query resolves after mount.
  useEffect(() => {
    if (order) reset(toFormValues(order));
  }, [order, reset]);

  const currency = watch('currency') || 'ETB';

  const mutation = useMutation({
    mutationFn: (values) =>
      isEdit ? updatePurchaseOrder(id, values) : createPurchaseOrder(values),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: purchaseOrderKeys.detail(id),
        });
      }
      // Same verb as the button that caused it.
      toast.success(isEdit ? 'Purchase order saved' : 'Purchase order created');
      navigate(`/purchase-orders/${saved.id}`);
    },
    onError: (error) => {
      // 422 carries `fields`, which maps straight onto the inputs.
      if (error.fields) {
        Object.entries(error.fields).forEach(([field, message]) =>
          setError(field, { message }),
        );
        toast.error('Could not save purchase order', {
          description: 'Check the highlighted fields.',
        });
        return;
      }
      // 409 = the order left draft while this form was open.
      toast.error('Could not save purchase order', {
        description: error.message,
      });
    },
  });

  if (isEdit && isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface" />
        <div className="h-96 animate-pulse rounded-md border border-border bg-surface" />
      </div>
    );
  }

  // Guard the case where someone reaches /edit by URL on an order that has
  // already moved on. The server would 409; saying so up front is kinder.
  if (isEdit && order && order.status !== 'draft') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <PageHeader title={order.poNumber} description={order.supplierName} />
        <div
          role="alert"
          className="rounded-md border border-warning bg-warning-bg px-3 py-2 text-sm text-warning"
        >
          Only a draft order can be edited. This one is{' '}
          {order.status.replace(/_/g, ' ')}.
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={() => navigate(`/purchase-orders/${id}`)}
          >
            Back to the order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <PageHeader
        title={isEdit ? 'Edit purchase order' : 'New purchase order'}
        description={
          isEdit
            ? order?.poNumber
            : 'Saved as a draft. Submit it for approval once the lines are right.'
        }
      />

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-6"
      >
        <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-text">
            Order
          </legend>

          <Controller
            name="supplierId"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Supplier"
                name={field.name}
                value={field.value ?? ''}
                onChange={field.onChange}
                options={supplierOptions}
                loading={suppliersLoading}
                error={errors.supplierId?.message}
                required
                searchable
              />
            )}
          />

          <FormField
            label="Order date"
            type="date"
            required
            error={errors.orderDate?.message}
            {...register('orderDate')}
          />

          <FormField
            label="Expected date"
            type="date"
            error={errors.expectedDate?.message}
            hint="Optional. When the supplier says it will arrive."
            {...register('expectedDate', {
              // Missing values are null, never "" (docs/entities.md).
              setValueAs: (value) => (value === '' ? null : value),
            })}
          />

          <FormField
            label="Currency"
            required
            error={errors.currency?.message}
            hint="Three-letter code, e.g. ETB."
            {...register('currency')}
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
        </fieldset>

        <PurchaseOrderLinesField
          control={control}
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          productOptions={productOptions}
          productsLoading={productsLoading}
          currency={currency}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Save purchase order' : 'Create purchase order'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              navigate(isEdit ? `/purchase-orders/${id}` : '/purchase-orders')
            }
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
