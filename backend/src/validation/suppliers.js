// Supplier validation — C owns this file. Ported from
// frontend/src/modules/suppliers/schema.js.
//
// `balance` is absent on purpose. It is what we owe the supplier, derived from
// received purchase orders, so a client that could set it could write off a
// debt from the browser. Same for `code`, which the server generates.

import { z } from 'zod';

import {
  addressSchema,
  currency,
  nullableString,
  nullableText,
} from './shared.js';

const supplierBase = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a supplier name.')
    .max(255, 'Name is too long.'),

  tin: nullableString,

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address.')
    .nullable()
    .transform((value) => (value === '' ? null : value)),

  phone: nullableString,
  contactPerson: nullableString,

  address: addressSchema,

  paymentTermsDays: z
    .number()
    .int('Use a whole number of days.')
    .min(0, 'Must be zero or greater.')
    .max(365, 'Must be 365 days or fewer.'),

  currency,

  status: z.enum(['active', 'inactive'], { error: () => 'Choose a status.' }),

  notes: nullableText,
});

export const supplierCreateSchema = supplierBase;
export const supplierUpdateSchema = supplierBase.partial();
