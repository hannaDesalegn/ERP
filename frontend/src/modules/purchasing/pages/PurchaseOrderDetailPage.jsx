/**
 * Purchase order detail — C owns this file.
 *
 * This page owns the status flow:
 *   draft → submit → pending_approval → approve → approved
 *         → receive → partially_received → received
 *   cancel is reachable from anything before received.
 *
 * Each action is a POST, not a PATCH of a status field. The buttons are only
 * shown in states where the action is legal — but that is UX, not enforcement:
 * the server rejects an illegal transition with a 409 regardless of what the UI
 * offered. docs/security-notes.md §2.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, PackageCheck, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  StatusBadge,
  toast,
} from '@/components/ui';
import { Can } from '@/lib/auth';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';

import { PurchaseOrderReceiveDialog } from '../components/PurchaseOrderReceiveDialog';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  fetchPurchaseOrder,
  purchaseOrderKeys,
  submitPurchaseOrder,
} from '../api';

/** Which statuses each action is legal from. Mirrors handlers.js. */
const ALLOWED_FROM = {
  edit: ['draft'],
  submit: ['draft'],
  approve: ['pending_approval'],
  receive: ['approved', 'partially_received'],
  cancel: ['draft', 'pending_approval', 'approved', 'partially_received'],
};

export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => fetchPurchaseOrder(id),
  });

  // The three simple transitions do the same four things on success and the
  // same one on failure, so the shared wiring lives in `transitionOptions` and
  // each useMutation call stays at the top level — hooks are never called from
  // a helper or a loop.
  const submission = useMutation(
    transitionOptions({
      mutationFn: () => submitPurchaseOrder(id),
      successMessage: 'Submitted for approval',
      failureMessage: 'Could not submit order',
      queryClient,
      id,
    }),
  );

  const approval = useMutation(
    transitionOptions({
      mutationFn: () => approvePurchaseOrder(id),
      successMessage: 'Approved',
      failureMessage: 'Could not approve order',
      queryClient,
      id,
    }),
  );

  const cancellation = useMutation(
    transitionOptions({
      mutationFn: () => cancelPurchaseOrder(id),
      successMessage: 'Cancelled',
      failureMessage: 'Could not cancel order',
      queryClient,
      id,
    }),
  );

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

  if (isLoading || !order) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface" />
        <div className="h-48 animate-pulse rounded-md border border-border bg-surface" />
      </div>
    );
  }

  const can = (action) => ALLOWED_FROM[action].includes(order.status);

  const lineColumns = [
    {
      key: 'sku',
      label: 'SKU',
      width: '110px',
      render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
    },
    { key: 'productName', label: 'Product' },
    {
      key: 'quantity',
      label: 'Ordered',
      align: 'right',
      render: (row) => formatNumber(row.quantity),
    },
    {
      key: 'quantityReceived',
      label: 'Received',
      align: 'right',
      // The one field that makes a PO line differ from a sales order line.
      render: (row) => (
        <span
          className={
            row.quantityReceived >= row.quantity ? 'text-success' : 'text-text'
          }
        >
          {formatNumber(row.quantityReceived)}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      label: 'Unit price',
      align: 'right',
      hideBelow: 'md',
      render: (row) => formatMoney(row.unitPrice, order.currency),
    },
    {
      key: 'discountPercent',
      label: 'Disc %',
      align: 'right',
      hideBelow: 'xl',
      render: (row) => `${row.discountPercent}%`,
    },
    {
      key: 'taxPercent',
      label: 'Tax %',
      align: 'right',
      hideBelow: 'xl',
      render: (row) => `${row.taxPercent}%`,
    },
    {
      key: 'lineTotal',
      label: 'Line total',
      align: 'right',
      render: (row) => formatMoney(row.lineTotal, order.currency),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title={order.poNumber}
        description={order.supplierName}
        actions={
          <>
            {can('edit') && (
              <Can permission="purchasing.edit">
                <Button
                  variant="secondary"
                  icon={Pencil}
                  onClick={() => navigate(`/purchase-orders/${order.id}/edit`)}
                >
                  Edit
                </Button>
              </Can>
            )}

            {can('submit') && (
              <Can permission="purchasing.edit">
                <Button
                  icon={Send}
                  loading={submission.isPending}
                  onClick={() => submission.mutate()}
                >
                  Submit
                </Button>
              </Can>
            )}

            {can('approve') && (
              <Can permission="purchasing.approve">
                <Button
                  icon={Check}
                  loading={approval.isPending}
                  onClick={() => approval.mutate()}
                >
                  Approve
                </Button>
              </Can>
            )}

            {can('receive') && (
              <Can permission="purchasing.receive">
                <Button icon={PackageCheck} onClick={() => setReceiving(true)}>
                  Receive goods
                </Button>
              </Can>
            )}

            {can('cancel') && (
              <Can permission="purchasing.edit">
                <Button
                  variant="destructive"
                  icon={X}
                  onClick={() => setCancelling(true)}
                >
                  Cancel order
                </Button>
              </Can>
            )}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Order">
          <Field label="Status">
            <StatusBadge status={order.status} variant="auto" />
          </Field>
          <Field label="Supplier">{order.supplierName}</Field>
          <Field label="Order date">{formatDate(order.orderDate)}</Field>
          <Field label="Expected">{formatDate(order.expectedDate)}</Field>
        </Card>

        <Card title="Totals">
          <Field label="Subtotal">
            {formatMoney(order.subtotal, order.currency)}
          </Field>
          <Field label="Tax">
            {formatMoney(order.taxTotal, order.currency)}
          </Field>
          <Field label="Grand total">
            <span className="font-medium">
              {formatMoney(order.grandTotal, order.currency)}
            </span>
          </Field>
          <Field label="Currency">{order.currency}</Field>
        </Card>

        <Card title="Record">
          <Field label="Raised by">{order.createdBy}</Field>
          <Field label="Approved by">{order.approvedBy ?? '—'}</Field>
          <Field label="Created">{formatDateTime(order.createdAt)}</Field>
          <Field label="Last updated">{formatDateTime(order.updatedAt)}</Field>
        </Card>
      </section>

      {order.notes && (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-text">Notes</h2>
          {/* Plain text. React escapes it — no dangerouslySetInnerHTML, ever. */}
          <p className="whitespace-pre-wrap text-sm text-text">{order.notes}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">Lines</h2>
        <DataTable
          columns={lineColumns}
          data={order.lines}
          total={order.lines.length}
          perPage={order.lines.length || 25}
          rowKey="id"
          density="compact"
        />
      </section>

      <PurchaseOrderReceiveDialog
        open={receiving}
        onClose={() => setReceiving(false)}
        order={order}
      />

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => {
          cancellation.mutate();
          setCancelling(false);
        }}
        title="Cancel this purchase order?"
        description={`${order.poNumber} will be marked cancelled. Nothing further can be received against it.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        variant="destructive"
        loading={cancellation.isPending}
      />
    </div>
  );
}

/**
 * Plain options builder, not a hook — it returns a config object and calls
 * nothing. Keeps the three useMutation calls above identical apart from the
 * verb, without hiding a hook inside a helper.
 */
function transitionOptions({
  mutationFn,
  successMessage,
  failureMessage,
  queryClient,
  id,
}) {
  return {
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      toast.success(successMessage);
    },
    onError: (error) => {
      // A 409 here means the order moved on under us — someone else approved
      // or cancelled it. The server's message says which.
      toast.error(failureMessage, { description: error.message });
    },
  };
}

function Card({ title, children }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-28 shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-text">{children}</dd>
    </div>
  );
}
