// backend/src/routes/customers.js
//
// B owns this file. Mirrors the frontend's api.js/handlers.js contract, now
// backed by real MongoDB instead of an in-memory array.

import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { validateBody } from '../utils/validate.js';
import { paginate } from '../utils/paginate.js';
import { ApiError } from '../middleware/error.js';
import { Customer } from '../models/Customer.js';

const router = express.Router();

// Every route needs a valid token first, then a specific permission.
router.use(requireAuth);

// ── Validation ────────────────────────────────────────────────────────────
// Copied from the frontend's schema.js, per backend-plan.md §3 — not
// reinvented here. Server-managed fields (code, balance, timestamps) are
// deliberately absent, same reasoning as the frontend: mass-assignment
// protection. Zod strips anything not listed, so a client can't smuggle them
// in even if it tries.

const addressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().nullable().or(z.literal('').transform(() => null)),
  city: z.string().trim().min(1),
  region: z.string().trim().nullable().or(z.literal('').transform(() => null)),
  country: z.string().length(2),
  postalCode: z.string().trim().nullable().or(z.literal('').transform(() => null)),
});

const nullableString = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .or(z.literal('').transform(() => null));

const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  type: z.enum(['company', 'individual']),
  tin: nullableString,
  email: z.string().email().nullable().or(z.literal('').transform(() => null)),
  phone: nullableString,
  contactPerson: nullableString,
  billingAddress: addressSchema,
  shippingAddress: addressSchema.nullable(),
  creditLimit: z.number().int().min(0),
  paymentTermsDays: z.number().int().min(0),
  currency: z.string().length(3),
  status: z.enum(['active', 'inactive', 'blocked']),
  notes: z.string().trim().max(2000).nullable(),
});

const customerUpdateSchema = customerCreateSchema.partial();

// ── Helpers ───────────────────────────────────────────────────────────────

/** CUS-0001, CUS-0002, ... — same shape as the frontend mock, real this time. */
async function nextCustomerCode() {
  const count = await Customer.countDocuments();
  return `CUS-${String(count + 1).padStart(4, '0')}`;
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/customers — list, paginated/sorted/filtered.
router.get('/', requirePermission('customers.view'), async (req, res, next) => {
  try {
    const result = await paginate(Customer, req.query, {
      searchFields: ['name', 'email', 'code'],
      sortable: ['name', 'createdAt', 'balance'],
      defaultSort: '-createdAt',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', requirePermission('customers.view'), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found.');
    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post(
  '/',
  requirePermission('customers.create'),
  validateBody(customerCreateSchema),
  async (req, res, next) => {
    try {
      const code = await nextCustomerCode();
      const customer = await Customer.create({
        ...req.body,
        code,
        balance: 0, // server-managed — never trust a client-sent balance
      });
      res.status(201).json({ data: customer });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/customers/:id
router.patch(
  '/:id',
  requirePermission('customers.edit'),
  validateBody(customerUpdateSchema),
  async (req, res, next) => {
    try {
      // Allow-list the update, per backend-plan.md §6.4 — never spread req.body
      // wholesale, even though validateBody already stripped unknown keys.
      // This is the second, explicit layer: only these fields are writable.
      const allowed = [
        'name', 'type', 'tin', 'email', 'phone', 'contactPerson',
        'billingAddress', 'shippingAddress', 'creditLimit',
        'paymentTermsDays', 'currency', 'status', 'notes',
      ];
      const patch = {};
      for (const key of allowed) {
        if (key in req.body) patch[key] = req.body[key];
      }

      const customer = await Customer.findByIdAndUpdate(req.params.id, patch, {
        new: true, // return the updated document, not the pre-update one
        runValidators: true,
      });
      if (!customer) throw ApiError.notFound('Customer not found.');
      res.json({ data: customer });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/customers/:id
router.delete('/:id', requirePermission('customers.delete'), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;