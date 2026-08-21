/**
 * Invoice detail (view-only) — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the fields shown, the section grouping.
 * KEEP:   the loading/not-found handling, and the ConfirmDialog + useMutation
 *         delete flow — copy that whole block, don't rebuild it.
 * This is read-only. amountDue and totals come straight from the server
 * response — never recalculated in this file.
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

import { deleteInvoice, fetchInvoice, invoiceKeys } from '../api';

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => fetchInvoice(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success('Invoice deleted');
      navigate('/invoices');
    },
    onError: (err) => {
      toast.error('Could not delete invoice', { description: err.message });
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

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-destructive">
          Could not load this invoice. It may have been deleted.
        </p>
        <Button variant="secondary" onClick={() => navigate('/invoices')}>
          Back to invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        title={invoice.invoiceNumber}
        description={invoice.customerName}
        breadcrumbs={[
          { label: 'Invoices', path: '/invoices' },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Pencil}
              permission="invoices.edit"
              onClick={() => navigate(`/invoices/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              icon={Trash}
              permission="invoices.delete"
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 rounded-lg border border-border p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer" value={invoice.customerName} />
          {/* status may read "overdue" here even though it was never chosen in
              the form — the server derives it from dueDate/amountDue. */}
          <Field label="Status" value={<StatusBadge status={invoice.status} variant="auto" />} />
          <Field label="Issue date" value={invoice.issueDate} />
          <Field label="Due date" value={invoice.dueDate} />
          <Field label="Linked order" value={invoice.salesOrderId} />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium">Line items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Product</th>
                <th className="py-2 text-right font-normal">Qty</th>
                <th className="py-2 text-right font-normal">Unit price</th>
                <th className="py-2 text-right font-normal">Tax</th>
                <th className="py-2 text-right font-normal">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-border last:border-b-0">
                  <td className="py-2">{line.productName}</td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{formatMoney(line.unitPrice, invoice.currency)}</td>
                  <td className="py-2 text-right">{line.taxPercent}%</td>
                  <td className="py-2 text-right">{formatMoney(line.lineTotal, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Server-owned figures — never recalculated on this page. */}
        <div className="border-t border-border pt-4">
          <div className="ml-auto flex w-56 flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tax</span>
              <span>{formatMoney(invoice.taxTotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Grand total</span>
              <span>{formatMoney(invoice.grandTotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Paid</span>
              <span>{formatMoney(invoice.amountPaid, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
              <span>Amount due</span>
              <span>{formatMoney(invoice.amountDue, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">Notes</h3>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete invoice?"
        description="This archives the invoice."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}