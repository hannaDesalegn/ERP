// Purchase order validation — C owns this file. Ported from
// frontend/src/modules/purchasing/schema.js.
//
// Absent on purpose, in every schema here: poNumber, supplierName, all totals,
// status, createdBy, approvedBy, and every line's quantityReceived and
// lineTotal.
//
// `status` matters most. A purchase order is created as a draft and moves only
// through the POST actions (/submit, /approve, /receive, /cancel). A status
// field here would let a crafted PATCH body skip approval entirely — which is
// exactly the attack api-contract.md § Status transitions describes.

import { z } from 'zod';

import { currency, dateOnly, money, nullableText, objectId } from './shared.js';

export const purchaseOrderLineSchema = z.object({
  productId: objectId,

  quantity: z
    .number()
    .positive('Enter a quantity above zero.')
    .max(1_000_000, 'That quantity looks wrong — check it.'),

  unitPrice: money,

  discountPercent: z
    .number()
    .min(0, 'Must be between 0 and 100.')
    .max(100, 'Must be between 0 and 100.'),

  taxPercent: z
    .number()
    .min(0, 'Must be between 0 and 100.')
    .max(100, 'Must be between 0 and 100.'),
});

const purchaseOrderBase = z.object({
  supplierId: objectId,

  orderDate: dateOnly,
  expectedDate: dateOnly
    .nullable()
    .transform((value) => (value === '' ? null : value)),

  lines: z
    .array(purchaseOrderLineSchema)
    .min(1, 'Add at least one line before saving.'),

  currency,

  notes: nullableText,
});

// ISO date-only strings compare correctly as strings, which is one of the
// reasons entities.md specifies that format.
const datesInOrder = (value) =>
  !value.expectedDate ||
  !value.orderDate ||
  value.expectedDate >= value.orderDate;

const datesInOrderError = {
  path: ['expectedDate'],
  message: 'Expected date cannot be before the order date.',
};

export const purchaseOrderCreateSchema = purchaseOrderBase.refine(
  datesInOrder,
  datesInOrderError,
);

export const purchaseOrderUpdateSchema = purchaseOrderBase
  .partial()
  .refine(datesInOrder, datesInOrderError);

// Receive goods. One entry per line actually delivered. This only checks the
// shape — the route checks it against what was ordered and what already
// arrived, because that needs the stored order.
export const receiveGoodsSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: objectId,
        quantityReceived: z
          .number()
          .min(0, 'Must be zero or greater.')
          .max(1_000_000, 'That quantity looks wrong — check it.'),
      }),
    )
    .min(1, 'Record at least one line.'),
});
