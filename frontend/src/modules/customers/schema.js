/**
 * Customer validation — B owns this file.
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
 */
export const customerCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a customer name.')
    .max(255, 'Name is too long.'),

  type: z.enum(['company', 'individual'], {
    errorMap: () => ({ message: 'Choose a customer type.' }),
  }),

  tin: nullableString,

  email: z
    .string()
    .trim()
    .email('Must be a valid email address.')
    .nullable()
    .or(z.literal('').transform(() => null)),

  phone: nullableString,
  contactPerson: nullableString,

  billingAddress: addressSchema,
  // null means "same as billing".
  shippingAddress: addressSchema.nullable(),

  // Integer in minor units. A float here is a bug — see docs/entities.md.
  creditLimit: z
    .number()
    .int('Amounts are whole numbers in minor units.')
    .min(0, 'Must be zero or greater.'),

  paymentTermsDays: z
    .number()
    .int()
    .min(0, 'Must be zero or greater.')
    .max(365, 'Must be 365 days or fewer.'),

  currency: z.string().length(3, 'Use a three-letter currency code.'),

  status: z.enum(['active', 'inactive', 'blocked']),

  notes: z.string().trim().max(2000).nullable(),
});

/**
 * Update is a PATCH: every field optional, same rules when present.
 * Never redefine the rules here — `.partial()` keeps the two in step.
 */
export const customerUpdateSchema = customerCreateSchema.partial();

/** Sensible starting values for a create form. */
export const customerDefaults = {
  name: '',
  type: 'company',
  tin: null,
  email: null,
  phone: null,
  contactPerson: null,
  billingAddress: {
    line1: null,
    line2: null,
    city: null,
    region: null,
    country: 'ET',
    postalCode: null,
  },
  shippingAddress: null,
  creditLimit: 0,
  paymentTermsDays: 30,
  currency: 'ETB',
  status: 'active',
  notes: null,
};

/** @typedef {z.infer<typeof customerCreateSchema>} CustomerInput */
