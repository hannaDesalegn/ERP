/**
 * Customer create/edit form — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields, the schema import, the API calls.
 * KEEP:   the create-vs-edit branching via useParams(), the RHF + Zod wiring,
 *         and the mutation → toast → navigate flow.
 * One component handles both /customers/new and /customers/:id/edit — don't
 * fork this into two files, the only difference is whether an id exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  FormActions,
  FormCheckbox,
  FormField,
  FormMoney,
  FormRow,
  FormSection,
  FormSelect,
  FormTextarea,
  PageHeader,
} from '@/components/ui';
import { toast } from '@/components/ui/toast';

import {
  createCustomer,
  customerKeys,
  fetchCustomer,
  updateCustomer,
} from '../api';
import {
  customerCreateSchema,
  customerDefaults,
  customerUpdateSchema,
} from '../schema';

const TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'individual', label: 'Individual' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

export function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit mode only: load the existing customer to pre-fill the form.
  const { data: existing, isLoading: isLoadingCustomer } = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: isEdit,
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? customerUpdateSchema : customerCreateSchema),
    // Only reset once `existing` arrives — until then, blank defaults.
    values: isEdit && existing ? existing : customerDefaults,
  });

  const type = watch('type');

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Customer created');
      navigate('/customers');
    },
    onError: (err) => {
      toast.error('Could not create customer', { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body) => updateCustomer(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      toast.success('Customer updated');
      navigate('/customers');
    },
    onError: (err) => {
      toast.error('Could not update customer', { description: err.message });
    },
  });

  const onSubmit = (values) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  if (isEdit && isLoadingCustomer) {
    return <div className="p-6 text-sm text-muted">Loading customer…</div>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        title={isEdit ? 'Edit customer' : 'Add customer'}
        description={
          isEdit
            ? `Editing ${existing?.name ?? ''}`
            : 'Create a new customer record.'
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormSection title="Basic info">
          <FormRow columns={2}>
            <FormField
              label="Name"
              {...register('name')}
              error={errors.name?.message}
              required
            />
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <FormSelect
                  label="Type"
                  options={TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.type?.message}
                  required
                />
              )}
            />
          </FormRow>

          <FormRow columns={2}>
            <FormField
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <FormField
              label="Phone"
              type="tel"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </FormRow>

          <FormRow columns={2}>
            <FormField
              label="TIN"
              {...register('tin')}
              error={errors.tin?.message}
              hint={type === 'individual' ? 'Usually left blank for individuals.' : undefined}
            />
            <FormField
              label="Contact person"
              {...register('contactPerson')}
              error={errors.contactPerson?.message}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Billing address"
          description="Required — used on invoices."
        >
          <FormField
            label="Address line 1"
            {...register('billingAddress.line1')}
            error={errors.billingAddress?.line1?.message}
            required
          />
          <FormField
            label="Address line 2"
            {...register('billingAddress.line2')}
            error={errors.billingAddress?.line2?.message}
          />
          <FormRow columns={3}>
            <FormField
              label="City"
              {...register('billingAddress.city')}
              error={errors.billingAddress?.city?.message}
              required
            />
            <FormField
              label="Region"
              {...register('billingAddress.region')}
              error={errors.billingAddress?.region?.message}
            />
            <FormField
              label="Postal code"
              {...register('billingAddress.postalCode')}
              error={errors.billingAddress?.postalCode?.message}
            />
          </FormRow>
          <FormField
            label="Country"
            {...register('billingAddress.country')}
            error={errors.billingAddress?.country?.message}
            hint="Two-letter code, e.g. ET"
            required
          />
        </FormSection>

        <FormSection
          title="Credit & payment terms"
          description="Money fields are stored as integers — the widget below converts for you."
        >
          <FormRow columns={2}>
            <Controller
              control={control}
              name="creditLimit"
              render={({ field }) => (
                <FormMoney
                  label="Credit limit"
                  currency={watch('currency') ?? 'ETB'}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.creditLimit?.message}
                />
              )}
            />
            <FormField
              label="Payment terms (days)"
              type="number"
              {...register('paymentTermsDays', { valueAsNumber: true })}
              error={errors.paymentTermsDays?.message}
            />
          </FormRow>
        </FormSection>

        <FormSection title="Status">
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
          <FormTextarea
            label="Notes"
            {...register('notes')}
            error={errors.notes?.message}
            rows={3}
          />
        </FormSection>

        <FormActions
          submitLabel={isEdit ? 'Save changes' : 'Create customer'}
          onCancel={() => navigate('/customers')}
          loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
        />
      </form>
    </div>
  );
}