/**
 * Customer detail (view-only) — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields shown, the section grouping.
 * KEEP:   the loading/not-found handling, and the ConfirmDialog + useMutation
 *         delete flow — copy that whole block, don't rebuild it.
 * This is read-only. Editing happens on /customers/:id/edit — link there,
 * never duplicate form fields on this page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pencil, Trash } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  ConfirmDialog,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/format';

import { customerKeys, deleteCustomer, fetchCustomer } from '../api';

/** One label/value row. Keeps the JSX below readable instead of repeating divs. */
function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: customer, isLoading, error } = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Customer deleted');
      navigate('/customers');
    },
    onError: (err) => {
      toast.error('Could not delete customer', { description: err.message });
      setConfirmOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton variant="card" rows={6} />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-destructive">
          Could not load this customer. It may have been deleted.
        </p>
        <Button variant="secondary" onClick={() => navigate('/customers')}>
          Back to customers
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        title={customer.name}
        description={customer.code}
        breadcrumbs={[
          { label: 'Customers', path: '/customers' },
          { label: customer.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Pencil}
              permission="customers.edit"
              onClick={() => navigate(`/customers/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              icon={Trash}
              permission="customers.delete"
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 rounded-lg border border-border p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" value={customer.type === 'company' ? 'Company' : 'Individual'} />
          <Field label="Status" value={<StatusBadge status={customer.status} variant="auto" />} />
          <Field label="Email" value={customer.email} />
          <Field label="Phone" value={customer.phone} />
          <Field label="TIN" value={customer.tin} />
          <Field label="Contact person" value={customer.contactPerson} />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium">Billing address</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Line 1" value={customer.billingAddress?.line1} />
            <Field label="Line 2" value={customer.billingAddress?.line2} />
            <Field label="City" value={customer.billingAddress?.city} />
            <Field label="Region" value={customer.billingAddress?.region} />
            <Field label="Postal code" value={customer.billingAddress?.postalCode} />
            <Field label="Country" value={customer.billingAddress?.country} />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium">Credit & payment terms</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Credit limit"
              value={formatMoney(customer.creditLimit, customer.currency)}
            />
            <Field
              label="Balance"
              value={formatMoney(customer.balance, customer.currency)}
            />
            <Field label="Payment terms" value={`${customer.paymentTermsDays} days`} />
          </div>
        </div>

        {customer.notes && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">Notes</h3>
            <p className="text-sm">{customer.notes}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete customer?"
        description="This archives the customer. Existing orders are unaffected."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}