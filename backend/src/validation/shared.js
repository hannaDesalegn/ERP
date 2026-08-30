// Field-level building blocks shared by C's schemas (products, suppliers,
// purchase orders). Ported from each frontend module's schema.js as
// backend-plan.md §3 requires — the rules mirror the frontend rather than
// being reinvented, so the two cannot drift.
//
// Note on the port: the frontend is on Zod 3 and this is Zod 4. The frontend's
// `.nullable().or(z.literal('').transform(() => null))` resolves to "" rather
// than null under Zod 4, because the nullable string branch matches the empty
// string first. entities.md says a missing value is null, never "", so the
// transform below is applied after the union instead.

import { z } from 'zod';

/** Missing values are null, never "" and never undefined (entities.md). */
export const nullableString = z
  .string()
  .trim()
  .max(255, 'That value is too long.')
  .nullable()
  .transform((value) => (value === '' ? null : value));

/** Long free text — notes fields. */
export const nullableText = z
  .string()
  .trim()
  .max(2000, 'That note is too long.')
  .nullable()
  .transform((value) => (value === '' ? null : value));

/** Money: integer, minor units. A float here is a bug (entities.md). */
export const money = z
  .number()
  .int('Amounts are whole numbers in minor units.')
  .min(0, 'Must be zero or greater.');

/** Quantities are not money, so decimals are allowed (2.5 kg). */
export const quantity = z
  .number()
  .min(0, 'Must be zero or greater.')
  .max(1_000_000, 'That quantity looks wrong — check it.');

/** ISO 4217, stored per document. */
export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'Use a three-letter currency code.');

/** Date-only "YYYY-MM-DD" — no timezone confusion on a due date. */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.');

/** entities.md Address. Every field nullable; country is ISO 3166-1 alpha-2. */
export const addressSchema = z.object({
  line1: nullableString,
  line2: nullableString,
  city: nullableString,
  region: nullableString,
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, 'Use the two-letter country code, e.g. ET.')
    .nullable(),
  postalCode: nullableString,
});

/**
 * A Mongo ObjectId arriving as a string. Rejecting the shape here means a bad
 * id becomes a 422 on the field rather than a 500 from a Mongoose cast.
 */
export const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'That is not a valid id.');
