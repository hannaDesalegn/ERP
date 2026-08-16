/**
 * Receive goods — C owns this file.
 *
 * `quantityReceived` is what drives the receive flow and the
 * `partially_received` status. It is the one field that makes a PO line differ
 * from a sales order line (docs/entities.md § PurchaseOrder).
 *
 * The dialog only ever sends what arrived THIS delivery. The server adds it to
 * what has already been received and re-derives the status — the client never
 * computes or sends a status.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button, Modal, toast } from '@/components/ui';
import { formatNumber } from '@/lib/format';

import { purchaseOrderKeys, receivePurchaseOrder } from '../api';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} props.order
 */
export function PurchaseOrderReceiveDialog({ open, onClose, order }) {
  const queryClient = useQueryClient();
  // lineId → what arrived this time, as the raw string the user typed.
  const [entries, setEntries] = useState({});
  const [formError, setFormError] = useState(null);

  // Reset every time the dialog opens, so a previous delivery's numbers are
  // never pre-filled into a new one.
  useEffect(() => {
    if (open) {
      setEntries({});
      setFormError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (body) => receivePurchaseOrder(order.id, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(order.id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });

      // Same verb as the button that caused it — docs/components.md § toasts.
      toast.success(
        updated.status === 'received'
          ? 'Received in full'
          : 'Received — order partially received',
      );
      onClose();
    },
    onError: (error) => {
      // 409 = over-receipt or a wrong status; 422 = a malformed quantity.
      // Both belong next to the inputs, not in a toast that disappears.
      setFormError(error.message);
    },
  });

  if (!order) return null;

  const outstandingOf = (line) => line.quantity - line.quantityReceived;

  const submit = () => {
    const lines = order.lines
      .map((line) => ({
        lineId: line.id,
        quantityReceived: Number(entries[line.id] ?? 0),
      }))
      // Lines with nothing entered are simply not part of this delivery.
      .filter((entry) => entry.quantityReceived > 0);

    if (lines.length === 0) {
      setFormError('Enter at least one quantity above zero.');
      return;
    }

    setFormError(null);
    mutation.mutate({ lines });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive goods"
      description={`${order.poNumber} — ${order.supplierName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            Receive
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">
          Enter what actually arrived in this delivery. Leave a line blank if
          nothing came for it.
        </p>

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            {formError}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {order.lines.map((line) => {
            const outstanding = outstandingOf(line);
            const settled = outstanding <= 0;

            return (
              <li
                key={line.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    <span className="font-mono text-xs">{line.sku}</span>{' '}
                    {line.productName}
                  </p>
                  <p className="text-xs text-text-muted">
                    Ordered {formatNumber(line.quantity)} · received{' '}
                    {formatNumber(line.quantityReceived)} · outstanding{' '}
                    {formatNumber(outstanding)}
                  </p>
                </div>

                <label className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Arrived</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={outstanding}
                    disabled={settled}
                    value={entries[line.id] ?? ''}
                    onChange={(event) =>
                      setEntries((current) => ({
                        ...current,
                        [line.id]: event.target.value,
                      }))
                    }
                    aria-label={`Quantity received for ${line.sku}`}
                    className="w-28 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                {settled && (
                  <span className="text-xs text-success">Complete</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
