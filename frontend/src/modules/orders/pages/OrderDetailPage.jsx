/**
 * Order detail (view-only) — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields shown, the section grouping.
 * KEEP:   the loading/not-found handling, and the ConfirmDialog + useMutation
 *         delete flow — copy that whole block, don't rebuild it.
 * This is read-only. Editing happens on /orders/:id/edit — link there, never
 * duplicate form fields on this page. Totals shown here come straight from
 * the server response — never recalculated in this file.
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

import { deleteOrder, fetchOrder, orderKeys } from '../api';

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => fetchOrder(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('Order deleted');
      navigate('/orders');
    },
    onError: (err) => {
      toast.error('Could not delete order', { description: err.message });
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

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-destructive">
          Could not load this order. It may have been deleted.
        </p>
        <Button variant="secondary" onClick={() => navigate('/orders')}>
          Back to orders
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        title={order.orderNumber}
        description={order.customerName}
        breadcrumbs={[
          { label: 'Orders', path: '/orders' },
          { label: order.orderNumber },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Pencil}
              permission="orders.edit"
              onClick={() => navigate(`/orders/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              icon={Trash}
              permission="orders.delete"
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 rounded-lg border border-border p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer" value={order.customerName} />
          <Field label="Status" value={<StatusBadge status={order.status} variant="auto" />} />
          <Field label="Order date" value={order.orderDate} />
          <Field label="Expected delivery" value={order.expectedDeliveryDate} />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium">Line items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Product</th>
                <th className="py-2 text-right font-normal">Qty</th>
                <th className="py-2 text-right font-normal">Unit price</th>
                <th className="py-2 text-right font-normal">Discount</th>
                <th className="py-2 text-right font-normal">Tax</th>
                <th className="py-2 text-right font-normal">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-border last:border-b-0">
                  <td className="py-2">{line.productName}</td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{formatMoney(line.unitPrice, order.currency)}</td>
                  <td className="py-2 text-right">{line.discountPercent}%</td>
                  <td className="py-2 text-right">{line.taxPercent}%</td>
                  <td className="py-2 text-right">{formatMoney(line.lineTotal, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* These totals come straight from the server — never recalculated here. */}
        <div className="border-t border-border pt-4">
          <div className="ml-auto flex w-56 flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatMoney(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Discount</span>
              <span>-{formatMoney(order.discountTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tax</span>
              <span>{formatMoney(order.taxTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
              <span>Grand total</span>
              <span>{formatMoney(order.grandTotal, order.currency)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">Notes</h3>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete order?"
        description="This archives the order. Linked invoices are unaffected."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}