/**
 * Product validation — C owns this file.
 *
 * These schemas get handed to the backend team as the executable version of the
 * validation rules, so they are written as if the server will run them.
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

/** Money: integer, minor units. A float here is a bug — docs/entities.md. */
const money = z
  .number()
  .int('Amounts are whole numbers in minor units.')
  .min(0, 'Must be zero or greater.');

/** Quantities are not money, so decimals are allowed (2.5 kg). */
const quantity = z
  .number()
  .min(0, 'Must be zero or greater.')
  .max(1_000_000, 'That quantity looks wrong — check it.');

/**
 * Create. Server-managed fields are deliberately absent: id, sku, categoryName,
 * quantityOnHand, quantityReserved, quantityAvailable, createdAt, updatedAt.
 * The client must not be able to set them and the backend must reject them if
 * sent (mass-assignment protection).
 *
 * quantityOnHand is absent for a second reason: stock only ever changes through
 * an adjustment record, never by typing a new number. See docs/entities.md.
 */
export const productCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a product name.')
      .max(255, 'Name is too long.'),

    description: z.string().trim().max(2000).nullable(),

    categoryId: z.string().trim().min(1, 'Choose a category.'),

    unitOfMeasure: z.enum(['pcs', 'kg', 'ltr', 'box'], {
      errorMap: () => ({ message: 'Choose a unit of measure.' }),
    }),

    costPrice: money,
    sellingPrice: money,

    currency: z.string().length(3, 'Use a three-letter currency code.'),

    reorderLevel: quantity,

    barcode: nullableString,
    imageUrl: nullableString,

    status: z.enum(['active', 'discontinued']),
  })
  .refine(
    (value) => value.status !== 'active' || value.sellingPrice > 0,
    // An active product with no selling price cannot be sold, and the error
    // belongs on the field the user has to fix.
    {
      path: ['sellingPrice'],
      message: 'An active product needs a selling price above zero.',
    },
  );

/**
 * Update is a PATCH: every field optional, same rules when present.
 * `.partial()` on the inner object keeps the two in step — a second hand-written
 * set of rules would drift within a week.
 */
export const productUpdateSchema = productCreateSchema.innerType().partial();

/**
 * Stock adjustment. This is the ONLY way quantityOnHand changes, which is what
 * gives the audit trail docs/entities.md requires.
 *
 * Note: the POST body in docs/api-contract.md §4 lists
 * { direction, quantity, reason, notes } but the StockAdjustment entity also
 * carries `reference`. Including it as optional; raised with the group.
 */
export const stockAdjustmentSchema = z.object({
  direction: z.enum(['increase', 'decrease'], {
    errorMap: () => ({ message: 'Choose increase or decrease.' }),
  }),

  quantity: z
    .number()
    .positive('Enter a quantity above zero.')
    .max(1_000_000, 'That quantity looks wrong — check it.'),

  reason: z.enum(
    ['purchase', 'sale', 'damage', 'loss', 'count_correction', 'return'],
    { errorMap: () => ({ message: 'Choose a reason.' }) },
  ),

  reference: nullableString,
  notes: z.string().trim().max(2000).nullable(),
});

/** Sensible starting values for a create form. */
export const productDefaults = {
  name: '',
  description: null,
  categoryId: '',
  unitOfMeasure: 'pcs',
  costPrice: 0,
  sellingPrice: 0,
  currency: 'ETB',
  reorderLevel: 0,
  barcode: null,
  imageUrl: null,
  status: 'active',
};

/** Starting values for the adjust-stock dialog. */
export const stockAdjustmentDefaults = {
  direction: 'increase',
  quantity: 1,
  reason: 'purchase',
  reference: null,
  notes: null,
};

/** @typedef {z.infer<typeof productCreateSchema>} ProductInput */
/** @typedef {z.infer<typeof stockAdjustmentSchema>} StockAdjustmentInput */
