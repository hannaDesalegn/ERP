/**
 * Supplier detail — C owns this file.
 *
 * The purchase-order table below is read-only. Creating and editing orders is
 * the purchasing module's job; this page only reports what exists.
 */

import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import { Can } from '@/auth/AuthContext';
import { formatDate, formatDateTime, formatMoney, safeUrl } from '@/lib/format';

import {
  fetchSupplier,
  fetchSupplierPurchaseOrders,
  supplierKeys,
} from '../api';

const purchaseOrderColumns = [
  {
    key: 'poNumber',
    label: 'PO number',
    width: '150px',
    // Order numbers render mono — docs/components.md § Design tokens.
    render: (row) => <span className="font-mono text-xs">{row.poNumber}</span>,
  },
  {
    key: 'orderDate',
    label: 'Order date',
    render: (row) => formatDate(row.orderDate),
  },
  {
    key: 'grandTotal',
    label: 'Total',
    align: 'right',
    render: (row) => formatMoney(row.grandTotal, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: supplier,
    isLoading,
    error,
  } = useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => fetchSupplier(id),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: supplierKeys.purchaseOrders(id),
    queryFn: () => fetchSupplierPurchaseOrders(id),
    enabled: Boolean(supplier),
  });

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        {/* Server `message` only — never a raw body or stack trace. */}
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !supplier) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface" />
        <div className="h-48 animate-pulse rounded-md border border-border bg-surface" />
      </div>
    );
  }

  const { address } = supplier;
  // Never put user-supplied input into an href without checking the scheme.
  // safeUrl returns null for anything that is not http/https/mailto/tel.
  const emailHref = safeUrl(supplier.email ? `mailto:${supplier.email}` : null);
  const phoneHref = safeUrl(supplier.phone ? `tel:${supplier.phone}` : null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title={supplier.name}
        description={supplier.code}
        actions={
          <Can permission="suppliers.edit">
            <Button
              icon={Pencil}
              onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
            >
              Edit
            </Button>
          </Can>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Contact">
          <Field label="Contact person">{supplier.contactPerson ?? '—'}</Field>
          <Field label="Email">
            {emailHref ? (
              <a className="text-primary hover:underline" href={emailHref}>
                {supplier.email}
              </a>
            ) : (
              (supplier.email ?? '—')
            )}
          </Field>
          <Field label="Phone">
            {phoneHref ? (
              <a className="text-primary hover:underline" href={phoneHref}>
                {supplier.phone}
              </a>
            ) : (
              (supplier.phone ?? '—')
            )}
          </Field>
          <Field label="TIN">
            {supplier.tin ? (
              <span className="font-mono text-xs">{supplier.tin}</span>
            ) : (
              '—'
            )}
          </Field>
        </Card>

        <Card title="Account">
          <Field label="We owe" hint="Server-calculated.">
            {formatMoney(supplier.balance, supplier.currency)}
          </Field>
          <Field label="Payment terms">
            {supplier.paymentTermsDays} days
          </Field>
          <Field label="Currency">{supplier.currency}</Field>
          <Field label="Status">
            <StatusBadge status={supplier.status} variant="auto" />
          </Field>
        </Card>

        <Card title="Address">
          <Field label="Street">{address?.line1 ?? '—'}</Field>
          <Field label="Line 2">{address?.line2 ?? '—'}</Field>
          <Field label="City">{address?.city ?? '—'}</Field>
          <Field label="Region">{address?.region ?? '—'}</Field>
          <Field label="Country">{address?.country ?? '—'}</Field>
          <Field label="Postal code">{address?.postalCode ?? '—'}</Field>
        </Card>

        <Card title="Record">
          <Field label="Notes">{supplier.notes ?? '—'}</Field>
          <Field label="Created">{formatDateTime(supplier.createdAt)}</Field>
          <Field label="Last updated">
            {formatDateTime(supplier.updatedAt)}
          </Field>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">Purchase orders</h2>
        <DataTable
          columns={purchaseOrderColumns}
          data={orders?.data ?? []}
          loading={ordersLoading}
          emptyState={
            <div className="text-center">
              <p className="text-sm font-medium text-text">
                No purchase orders yet
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Orders raised against this supplier will appear here.
              </p>
            </div>
          }
          page={orders?.meta?.page ?? 1}
          perPage={orders?.meta?.perPage ?? 25}
          total={orders?.meta?.total ?? 0}
          onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
          rowKey="id"
          density="compact"
        />
      </section>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-32 shrink-0 text-text-muted">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd className="min-w-0 flex-1 text-text">{children}</dd>
    </div>
  );
}
