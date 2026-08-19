/**
 * Invoice create/edit form — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields, the schema import, the API calls, PRODUCT_OPTIONS.
 * KEEP:   the create-vs-edit branching via useParams(), the RHF + Zod wiring,
 *         useFieldArray for lines, and the mutation → toast → navigate flow.
 *
 * PRODUCT_OPTIONS is a TEMPORARY hardcoded list standing in for the Products
 * module (C's), which isn't built yet. Swap for a real fetchProducts() call
 * once it ships.
 *
 * amountDue is NEVER a form field — it is always grandTotal - amountPaid,
 * computed server-side (docs/entities.md). This form shows it read-only.
 * Totals shown here are a CLIENT-SIDE PREVIEW ONLY; the server recomputes
 * subtotal/taxTotal/grandTotal/amountDue on save.
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
import { fetchOrders } from '@/modules/orders/api';

import { createInvoice, fetchInvoice, invoiceKeys, updateInvoice } from '../api';
import {
  invoiceCreateSchema,
  invoiceDefaults,
  invoiceUpdateSchema,
} from '../schema';

// TEMPORARY — see file header. Replace with a real product fetch.
const PRODUCT_OPTIONS = [
  { value: 'prd_0001', label: 'Steel Roofing Sheet 2mm', unitPrice: 85000 },
  { value: 'prd_0002', label: 'Cement 50kg Bag', unitPrice: 62000 },
  { value: 'prd_0003', label: 'Ceramic Floor Tile (box)', unitPrice: 145000 },
  { value: 'prd_0004', label: 'PVC Pipe 4-inch (6m)', unitPrice: 39000 },
  { value: 'prd_0005', label: 'LED Panel Light 40W', unitPrice: 21000 },
];

// 'overdue' excluded on purpose — it's server-derived, never chosen.
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

/** Client-side preview only — same formula as mock.js, never sent to the server. */
function previewLineTotal(unitPrice, quantity, taxPercent) {
  const gross = (unitPrice || 0) * (quantity || 0);
  return Math.round(gross + (gross * (taxPercent || 0)) / 100);
}

export function InvoiceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit mode only: load the existing invoice to pre-fill the form.
  const { data: existing, isLoading: isLoadingInvoice } = useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => fetchInvoice(id),
    enabled: isEdit,
  });

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () => fetchCustomers({ page: 1, perPage: 100, sort: 'name' }),
  });
  const customerOptions =
    customersData?.data?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  // Optional link back to a sales order — not every invoice comes from one.
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', 'picker'],
    queryFn: () => fetchOrders({ page: 1, perPage: 100, sort: '-createdAt' }),
  });
  const orderOptions = [
    { value: '', label: 'None (walk-in / no linked order)' },
    ...(ordersData?.data?.map((o) => ({ value: o.id, label: o.orderNumber })) ?? []),
  ];

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? invoiceUpdateSchema : invoiceCreateSchema),
    values: isEdit && existing ? existing : invoiceDefaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const watchedAmountPaid = watch('amountPaid');
  const currency = watch('currency') ?? 'ETB';

  // Preview totals — display only. amountDue mirrors the server's formula
  // (grandTotal - amountPaid) but is never itself submitted.
  const previewSubtotal = (watchedLines ?? []).reduce((sum, line) => {
    const product = PRODUCT_OPTIONS.find((p) => p.value === line.productId);
    return sum + (product?.unitPrice ?? 0) * (line.quantity || 0);
  }, 0);
  const previewGrandTotal = (watchedLines ?? []).reduce((sum, line) => {
    const product = PRODUCT_OPTIONS.find((p) => p.value === line.productId);
    return sum + previewLineTotal(product?.unitPrice, line.quantity, line.taxPercent);
  }, 0);
  const previewAmountDue = previewGrandTotal - (watchedAmountPaid || 0);

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success('Invoice created');
      navigate('/invoices');
    },
    onError: (err) => {
      toast.error('Could not create invoice', { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body) => updateInvoice(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success('Invoice updated');
      navigate('/invoices');
    },
    onError: (err) => {
      toast.error('Could not update invoice', { description: err.message });
    },
  });

  const onSubmit = (values) => {
    // '' from the "None" option means no linked order — normalize to null.
    const body = { ...values, salesOrderId: values.salesOrderId || null };
    if (isEdit) {
      updateMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  };

  if (isEdit && isLoadingInvoice) {
    return <div className="p-6 text-sm text-muted">Loading invoice…</div>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <PageHeader
        title={isEdit ? 'Edit invoice' : 'Add invoice'}
        description={
          isEdit ? `Editing ${existing?.invoiceNumber ?? ''}` : 'Create a new invoice.'
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormSection title="Invoice info">
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
              name="salesOrderId"
              render={({ field }) => (
                <FormSelect
                  label="Linked order"
                  options={orderOptions}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.salesOrderId?.message}
                  searchable
                  clearable
                  loading={isLoadingOrders}
                />
              )}
            />
          </FormRow>

          <FormRow columns={3}>
            <Controller
              control={control}
              name="issueDate"
              render={({ field }) => (
                <FormField
                  label="Issue date"
                  type="date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.issueDate?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <FormField
                  label="Due date"
                  type="date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.dueDate?.message}
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
                  hint="'Overdue' is set automatically by the server, never chosen here."
                  required
                />
              )}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Line items"
          description="Product, quantity and tax per line. Totals below are a preview — the server calculates the real ones on save."
        >
          {fields.map((field, index) => {
            const line = watchedLines?.[index];
            const product = PRODUCT_OPTIONS.find((p) => p.value === line?.productId);
            const lineTotal = previewLineTotal(product?.unitPrice, line?.quantity, line?.taxPercent);

            return (
              <div
                key={field.id}
                className="flex flex-col gap-3 border-b border-border pb-4 last:border-b-0"
              >
                <FormRow columns={3}>
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
            onClick={() => append({ productId: '', quantity: 1, taxPercent: 15 })}
          >
            Add line item
          </Button>
        </FormSection>

        <FormSection
          title="Payment"
          description="amountDue is calculated by the server (grandTotal − amountPaid) — shown here read-only, never edited directly."
        >
          <FormRow columns={2}>
            <Controller
              control={control}
              name="amountPaid"
              render={({ field }) => (
                <FormMoney
                  label="Amount paid"
                  currency={currency}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.amountPaid?.message}
                />
              )}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">Amount due (preview)</span>
              <span className="text-lg font-medium">
                {formatMoney(previewAmountDue, currency)}
              </span>
            </div>
          </FormRow>
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
          submitLabel={isEdit ? 'Save changes' : 'Create invoice'}
          onCancel={() => navigate('/invoices')}
          loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
        />
      </form>
    </div>
  );
}