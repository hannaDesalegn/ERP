/**
 * SalesOrder create/edit form — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields, the schema import, the API calls, PRODUCT_OPTIONS.
 * KEEP:   the create-vs-edit branching via useParams(), the RHF + Zod wiring,
 *         useFieldArray for lines, and the mutation → toast → navigate flow.
 *
 * PRODUCT_OPTIONS is a TEMPORARY hardcoded list standing in for the Products
 * module (C's), which isn't built yet. Swap this for a real fetchProducts()
 * call once it ships — do not leave this hardcoded past that point.
 *
 * Totals shown here are a CLIENT-SIDE PREVIEW ONLY (docs/entities.md). The
 * server recomputes subtotal/discountTotal/taxTotal/grandTotal on save; this
 * form never sends them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  FormActions,
  FormField,
  FormMoney,
  FormRow,
  FormSection,
  FormSelect,
  FormTextarea,
  PageHeader,
} from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/format';

import { fetchCustomers } from '@/modules/customers/api';

import { createOrder, fetchOrder, orderKeys, updateOrder } from '../api';
import {
  salesOrderCreateSchema,
  salesOrderDefaults,
  salesOrderUpdateSchema,
} from '../schema';

// TEMPORARY — see file header. Replace with a real product fetch.
const PRODUCT_OPTIONS = [
  { value: 'prd_0001', label: 'Steel Roofing Sheet 2mm', unitPrice: 85000 },
  { value: 'prd_0002', label: 'Cement 50kg Bag', unitPrice: 62000 },
  { value: 'prd_0003', label: 'Ceramic Floor Tile (box)', unitPrice: 145000 },
  { value: 'prd_0004', label: 'PVC Pipe 4-inch (6m)', unitPrice: 39000 },
  { value: 'prd_0005', label: 'LED Panel Light 40W', unitPrice: 21000 },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Client-side preview only — same formula as mock.js, never sent to the server. */
function previewLineTotal(unitPrice, quantity, discountPercent, taxPercent) {
  const gross = (unitPrice || 0) * (quantity || 0);
  const afterDiscount = gross - Math.round((gross * (discountPercent || 0)) / 100);
  return Math.round(afterDiscount + (afterDiscount * (taxPercent || 0)) / 100);
}

export function OrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit mode only: load the existing order to pre-fill the form.
  const { data: existing, isLoading: isLoadingOrder } = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: isEdit,
  });

  // Customer dropdown options. A real app would debounce this on search input;
  // fetching one page up front is fine while the customer list is small.
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () => fetchCustomers({ page: 1, perPage: 100, sort: 'name' }),
  });
  const customerOptions =
    customersData?.data?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? salesOrderUpdateSchema : salesOrderCreateSchema),
    values: isEdit && existing ? existing : salesOrderDefaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const currency = watch('currency') ?? 'ETB';

  // Preview totals — display only, matches mock.js's math so it won't
  // surprise anyone once the server responds with the real numbers.
  const previewSubtotal = (watchedLines ?? []).reduce((sum, line) => {
    const product = PRODUCT_OPTIONS.find((p) => p.value === line.productId);
    return sum + (product?.unitPrice ?? 0) * (line.quantity || 0);
  }, 0);
  const previewGrandTotal = (watchedLines ?? []).reduce((sum, line) => {
    const product = PRODUCT_OPTIONS.find((p) => p.value === line.productId);
    return (
      sum +
      previewLineTotal(product?.unitPrice, line.quantity, line.discountPercent, line.taxPercent)
    );
  }, 0);

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('Order created');
      navigate('/orders');
    },
    onError: (err) => {
      toast.error('Could not create order', { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body) => updateOrder(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Order updated');
      navigate('/orders');
    },
    onError: (err) => {
      toast.error('Could not update order', { description: err.message });
    },
  });

  const onSubmit = (values) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  if (isEdit && isLoadingOrder) {
    return <div className="p-6 text-sm text-muted">Loading order…</div>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <PageHeader
        title={isEdit ? 'Edit order' : 'Add order'}
        description={
          isEdit ? `Editing ${existing?.orderNumber ?? ''}` : 'Create a new sales order.'
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormSection title="Order info">
          <FormRow columns={2}>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <FormSelect
                  label="Customer"
                  options={customerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.customerId?.message}
                  searchable
                  loading={isLoadingCustomers}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <FormSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.status?.message}
                  required
                />
              )}
            />
          </FormRow>

          <FormRow columns={2}>
            <Controller
              control={control}
              name="orderDate"
              render={({ field }) => (
                <FormField
                  label="Order date"
                  type="date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.orderDate?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="expectedDeliveryDate"
              render={({ field }) => (
                <FormField
                  label="Expected delivery"
                  type="date"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  error={errors.expectedDeliveryDate?.message}
                />
              )}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Line items"
          description="Product, quantity, discount and tax per line. Totals below are a preview — the server calculates the real ones on save."
        >
          {fields.map((field, index) => {
            const line = watchedLines?.[index];
            const product = PRODUCT_OPTIONS.find((p) => p.value === line?.productId);
            const lineTotal = previewLineTotal(
              product?.unitPrice,
              line?.quantity,
              line?.discountPercent,
              line?.taxPercent,
            );

            return (
              <div
                key={field.id}
                className="flex flex-col gap-3 border-b border-border pb-4 last:border-b-0"
              >
                <FormRow columns={4}>
                  <Controller
                    control={control}
                    name={`lines.${index}.productId`}
                    render={({ field: f }) => (
                      <FormSelect
                        label="Product"
                        options={PRODUCT_OPTIONS}
                        value={f.value}
                        onChange={f.onChange}
                        error={errors.lines?.[index]?.productId?.message}
                        searchable
                        required
                      />
                    )}
                  />
                  <FormField
                    label="Quantity"
                    type="number"
                    {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                    error={errors.lines?.[index]?.quantity?.message}
                    required
                  />
                  <FormField
                    label="Discount %"
                    type="number"
                    {...register(`lines.${index}.discountPercent`, { valueAsNumber: true })}
                    error={errors.lines?.[index]?.discountPercent?.message}
                  />
                  <FormField
                    label="Tax %"
                    type="number"
                    {...register(`lines.${index}.taxPercent`, { valueAsNumber: true })}
                    error={errors.lines?.[index]?.taxPercent?.message}
                  />
                </FormRow>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    Line total (preview): {formatMoney(lineTotal, currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    icon={Trash}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}

          {errors.lines?.message && (
            <p className="text-sm text-destructive">{errors.lines.message}</p>
          )}

          <Button
            type="button"
            variant="secondary"
            icon={Plus}
            onClick={() =>
              append({ productId: '', quantity: 1, discountPercent: 0, taxPercent: 15 })
            }
          >
            Add line item
          </Button>
        </FormSection>

        <FormSection title="Totals (preview)">
          <FormRow columns={2}>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">Subtotal (preview)</span>
              <span className="text-lg font-medium">
                {formatMoney(previewSubtotal, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">Grand total (preview)</span>
              <span className="text-lg font-medium">
                {formatMoney(previewGrandTotal, currency)}
              </span>
            </div>
          </FormRow>
        </FormSection>

        <FormSection title="Notes">
          <FormTextarea
            label="Notes"
            {...register('notes')}
            error={errors.notes?.message}
            rows={3}
          />
        </FormSection>

        <FormActions
          submitLabel={isEdit ? 'Save changes' : 'Create order'}
          onCancel={() => navigate('/orders')}
          loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
        />
      </form>
    </div>
  );
}