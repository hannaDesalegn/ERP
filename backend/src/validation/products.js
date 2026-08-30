// Product validation — C owns this file. Ported from
// frontend/src/modules/products/schema.js, which backend-plan.md §3 names as
// the executable version of these rules.
//
// Server-managed fields are absent from every schema here, and validateBody
// parses rather than checks, so Zod strips them. That is the mass-assignment
// protection security-notes.md §4 asks for: a client cannot smuggle in sku,
// quantityOnHand or categoryName by adding them to the body.

import { z } from 'zod';

import {
  currency,
  money,
  nullableString,
  nullableText,
  objectId,
  quantity,
} from './shared.js';

const productBase = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a product name.')
    .max(255, 'Name is too long.'),

  description: nullableText,

  categoryId: objectId,

  unitOfMeasure: z.enum(['pcs', 'kg', 'ltr', 'box'], {
    error: () => 'Choose a unit of measure.',
  }),

  costPrice: money,
  sellingPrice: money,
  currency,

  reorderLevel: quantity,

  barcode: nullableString,
  imageUrl: nullableString,

  status: z.enum(['active', 'discontinued'], {
    error: () => 'Choose a status.',
  }),
});

// An active product with no selling price cannot be sold, and the message
// belongs on the field the user has to fix.
const sellablePrice = (value) =>
  value.status !== 'active' ||
  value.sellingPrice === undefined ||
  value.sellingPrice > 0;

const sellablePriceError = {
  path: ['sellingPrice'],
  message: 'An active product needs a selling price above zero.',
};

export const productCreateSchema = productBase.refine(
  sellablePrice,
  sellablePriceError,
);

// PATCH: every field optional, same rules when present. Built from the same
// base rather than a second hand-written set, so the two cannot drift.
export const productUpdateSchema = productBase
  .partial()
  .refine(sellablePrice, sellablePriceError);

// The only way stock changes. entities.md § Product.
export const stockAdjustmentSchema = z.object({
  direction: z.enum(['increase', 'decrease'], {
    error: () => 'Choose increase or decrease.',
  }),

  quantity: z
    .number()
    .positive('Enter a quantity above zero.')
    .max(1_000_000, 'That quantity looks wrong — check it.'),

  reason: z.enum(
    ['purchase', 'sale', 'damage', 'loss', 'count_correction', 'return'],
    { error: () => 'Choose a reason.' },
  ),

  reference: nullableString,
  notes: nullableText,
});

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a category name.')
    .max(255, 'Name is too long.'),
});
