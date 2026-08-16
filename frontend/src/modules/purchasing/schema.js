/**
 * Purchase order validation — C owns this file.
 *
 * These schemas get handed to the backend team as the executable version of the
 * validation rules, so they are written as if the server will run them.
 *
 * Zod validating here is UX. The server re-validates everything and is the
 * actual control. See docs/security-notes.md §2.
 */

import { z } from 'zod';

/** Date-only, "YYYY-MM-DD" — no timezone confusion on a due date. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.');

/**
 * One order line.
 *
 * `lineTotal` is deliberately absent: totals are always server-calculated and
 * the UI never sends them (docs/entities.md § SalesOrder). So are `productName`
 * and `sku` — the server denormalises those from productId at the time the
 * order is placed, and a client that could set them could rewrite history.
 */
export const purchaseOrderLineSchema = z.object({
  productId: z.string().trim().min(1, 'Choose a product.'),

  quantity: z
    .number()
    .positive('Enter a quantity above zero.')
    .max(1_000_000, 'That quantity looks wrong — check it.'),

  // Integer in minor units. A float here is a bug.
  unitPrice: z
    .number()
    .int('Amounts are whole numbers in minor units.')
    .min(0, 'Must be zero or greater.'),

  discountPercent: z
    .number()
    .min(0, 'Must be between 0 and 100.')
    .max(100, 'Must be between 0 and 100.'),

  taxPercent: z
    .number()
    .min(0, 'Must be between 0 and 100.')
    .max(100, 'Must be between 0 and 100.'),
});

/**
 * Create. Server-managed fields are deliberately absent: id, poNumber,
 * supplierName, all totals, status, createdBy, approvedBy, createdAt,
 * updatedAt, and every line's quantityReceived.
 *
 * `status` in particular: a purchase order is created as a draft and moves
 * only through the POST actions (/submit, /approve, /receive, /cancel). A
 * status field here would let a crafted body skip approval entirely —
 * docs/api-contract.md § Status transitions are POST actions.
 */
export const purchaseOrderCreateSchema = z
  .object({
    supplierId: z.string().trim().min(1, 'Choose a supplier.'),

    orderDate: dateOnly,
    expectedDate: dateOnly.nullable().or(z.literal('').transform(() => null)),

    lines: z
      .array(purchaseOrderLineSchema)
      .min(1, 'Add at least one line before saving.'),

    currency: z.string().length(3, 'Use a three-letter currency code.'),

    notes: z.string().trim().max(2000).nullable(),
  })
  .refine(
    (value) =>
      !value.expectedDate || value.expectedDate >= value.orderDate,
    // ISO date-only strings compare correctly as strings, which is one of the
    // reasons docs/entities.md specifies that format.
    {
      path: ['expectedDate'],
      message: 'Expected date cannot be before the order date.',
    },
  );

/** Update is a PATCH: every field optional, same rules when present. */
export const purchaseOrderUpdateSchema = purchaseOrderCreateSchema
  .innerType()
  .partial();

/**
 * Receive goods. One entry per line actually delivered.
 * The server checks it against what was ordered and what has already arrived —
 * this only checks the shape.
 */
export const receiveGoodsSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        quantityReceived: z
          .number()
          .min(0, 'Must be zero or greater.')
          .max(1_000_000, 'That quantity looks wrong — check it.'),
      }),
    )
    .min(1),
});

/** Sensible starting values for a create form. */
export const purchaseOrderDefaults = {
  supplierId: '',
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: null,
  lines: [],
  currency: 'ETB',
  notes: null,
};

/** A blank line, for the "Add line" button. */
export const purchaseOrderLineDefaults = {
  productId: '',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: 15,
};

/** @typedef {z.infer<typeof purchaseOrderCreateSchema>} PurchaseOrderInput */
/** @typedef {z.infer<typeof receiveGoodsSchema>} ReceiveGoodsInput */
