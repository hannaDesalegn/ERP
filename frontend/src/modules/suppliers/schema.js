/**
 * Supplier validation — C owns this file.
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

const addressSchema = z.object({
  line1: nullableString,
  line2: nullableString,
  city: nullableString,
  region: nullableString,
  country: z
    .string()
    .length(2, 'Use the two-letter country code, e.g. ET.')
    .nullable(),
  postalCode: nullableString,
});

/**
 * Create. Server-managed fields (id, code, balance, createdAt, updatedAt) are
 * deliberately absent — the client must not be able to set them, and the
 * backend must reject them if sent (mass-assignment protection).
 *
 * `balance` in particular: it is what we owe the supplier, derived from
 * received purchase orders and payments. A client that could set it could
 * write off a debt from the browser.
 */
export const supplierCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a supplier name.')
    .max(255, 'Name is too long.'),

  tin: nullableString,

  email: z
    .string()
    .trim()
    .email('Must be a valid email address.')
    .nullable()
    .or(z.literal('').transform(() => null)),

  phone: nullableString,
  contactPerson: nullableString,

  address: addressSchema,

  paymentTermsDays: z
    .number()
    .int()
    .min(0, 'Must be zero or greater.')
    .max(365, 'Must be 365 days or fewer.'),

  currency: z.string().length(3, 'Use a three-letter currency code.'),

  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Choose a status.' }),
  }),

  notes: z.string().trim().max(2000).nullable(),
});

/**
 * Update is a PATCH: every field optional, same rules when present.
 * Never redefine the rules here — `.partial()` keeps the two in step.
 */
export const supplierUpdateSchema = supplierCreateSchema.partial();

/** Sensible starting values for a create form. */
export const supplierDefaults = {
  name: '',
  tin: null,
  email: null,
  phone: null,
  contactPerson: null,
  address: {
    line1: null,
    line2: null,
    city: null,
    region: null,
    country: 'ET',
    postalCode: null,
  },
  paymentTermsDays: 30,
  currency: 'ETB',
  status: 'active',
  notes: null,
};

/** @typedef {z.infer<typeof supplierCreateSchema>} SupplierInput */
