/**
 * SalesOrder validation — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: every field, to match your entity in docs/entities.md.
 * KEEP:   the create/update split, money as integers, `.nullable()` rather than
 *         optional-empty-string, and messages written the way they should read
 *         to a user.
 * These schemas get handed to the backend team as the executable version of the
 * validation rules — they mirror them server-side rather than inventing a
 * second set that drifts. So write them as if the server will run them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Zod validating here is UX. The server re-validates everything and is the
 * actual control. See docs/security-notes.md §2.
 */

import { z } from 'zod';

/** Missing values are null, never "" and never undefined (docs/entities.md). */
const nullableString = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .or(z.literal('').transform(() => null));

const lineItemSchema = z.object({
  productId: z.string().min(1, 'Choose a product.'),
  // productName, sku and unitPrice are denormalised server-side at the moment
  // the line is added — the client does not invent them.
  quantity: z
    .number()
    .int('Quantity is a whole number.')
    .min(1, 'Must be at least 1.'),
  discountPercent: z.number().min(0).max(100, 'Must be 0-100.'),
  taxPercent: z.number().min(0).max(100, 'Must be 0-100.'),
});

/**
 * Create. Server-managed fields (id, orderNumber, lines[].productName/sku/
 * unitPrice/lineTotal, subtotal, discountTotal, taxTotal, grandTotal,
 * approvedBy, createdAt, updatedAt) are deliberately absent — the client must
 * not be able to set them, and the backend must reject them if sent
 * (mass-assignment protection).
 */
export const salesOrderCreateSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),

  orderDate: z.string().min(1, 'Pick an order date.'), // YYYY-MM-DD

  expectedDeliveryDate: nullableString,

  lines: z.array(lineItemSchema).min(1, 'Add at least one line item.'),

  currency: z.string().length(3, 'Use a three-letter currency code.'),

  status: z.enum([
    'draft',
    'pending_approval',
    'approved',
    'fulfilled',
    'cancelled',
  ]),

  notes: z.string().trim().max(2000).nullable(),
});

/**
 * Update is a PATCH: every field optional, same rules when present.
 * Never redefine the rules here — `.partial()` keeps the two in step.
 */
export const salesOrderUpdateSchema = salesOrderCreateSchema.partial();

/** Sensible starting values for a create form. */
export const salesOrderDefaults = {
  customerId: '',
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDeliveryDate: null,
  lines: [],
  currency: 'ETB',
  status: 'draft',
  notes: null,
};

/** @typedef {z.infer<typeof salesOrderCreateSchema>} SalesOrderInput */