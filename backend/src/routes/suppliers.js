// Supplier routes — C owns this file.
//
// The simplest of C's three: the five verbs plus one nested list. Same rules as
// everywhere else — permission on every route including GET, allow-listed PATCH
// fields, and server-generated code.

import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { requirePermission } from '../middleware/permissions.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import { paginate } from '../utils/paginate.js';
import { nextNumber } from '../utils/sequence.js';
import { validateBody } from '../utils/validate.js';
import {
  supplierCreateSchema,
  supplierUpdateSchema,
} from '../validation/suppliers.js';

const router = express.Router();

router.use(requireAuth);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const SEARCH_FIELDS = ['code', 'name', 'email', 'phone', 'contactPerson'];

const SORTABLE = ['code', 'name', 'balance', 'status', 'createdAt'];

// balance and code are absent: both are server-owned. A client that could set
// balance could write off what we owe from the browser.
const ALLOWED_PATCH_FIELDS = [
  'name',
  'tin',
  'email',
  'phone',
  'contactPerson',
  'address',
  'paymentTermsDays',
  'currency',
  'status',
  'notes',
];

/** Loads a supplier by id, or throws the 404 the contract specifies. */
async function loadSupplier(id) {
  if (!OBJECT_ID.test(id)) throw ApiError.notFound('Supplier not found.');

  const supplier = await Supplier.findById(id);
  if (!supplier) throw ApiError.notFound('Supplier not found.');

  return supplier;
}

router.get('/', requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const result = await paginate(Supplier, req.query, {
      searchFields: SEARCH_FIELDS,
      sortable: SORTABLE,
      defaultSort: 'code',
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/:id',
  requirePermission('suppliers.view'),
  async (req, res, next) => {
    try {
      res.json({ data: await loadSupplier(req.params.id) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requirePermission('suppliers.create'),
  validateBody(supplierCreateSchema),
  async (req, res, next) => {
    try {
      const supplier = await Supplier.create({
        ...req.body,
        // Server-generated, and balance starts at zero — it is derived from
        // received orders and payments, never supplied.
        code: await nextNumber(Supplier, 'code', (n) => `SUP-${n}`),
        balance: 0,
      });

      res
        .status(201)
        .location(`/api/suppliers/${supplier.id}`)
        .json({ data: supplier });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('suppliers.edit'),
  validateBody(supplierUpdateSchema),
  async (req, res, next) => {
    try {
      const supplier = await loadSupplier(req.params.id);

      // Field by field — security-notes.md §4.
      for (const field of ALLOWED_PATCH_FIELDS) {
        if (req.body[field] !== undefined) supplier[field] = req.body[field];
      }

      await supplier.save();
      res.json({ data: supplier });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requirePermission('suppliers.delete'),
  async (req, res, next) => {
    try {
      const supplier = await loadSupplier(req.params.id);

      // Same reasoning as the product delete: soft deletes are out of scope, so
      // refuse the delete that would orphan a live reference rather than
      // silently breaking a purchase order's supplierName.
      const openOrder = await PurchaseOrder.exists({
        supplierId: supplier._id,
        status: { $nin: ['received', 'cancelled'] },
      });

      if (openOrder) {
        throw ApiError.conflict(
          'This supplier has purchase orders that are still open. Cancel or receive them first.',
        );
      }

      await supplier.deleteOne();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ── That supplier's purchase orders ──────────────────────────────────────────

router.get(
  '/:id/purchase-orders',
  // Reading a supplier's orders is reading purchasing data, so it needs the
  // purchasing permission as well as the supplier one. The stricter of the two
  // is the one that matters, and requiring both is what "deny by default" means
  // when an endpoint spans two resources.
  requirePermission('suppliers.view'),
  requirePermission('purchasing.view'),
  async (req, res, next) => {
    try {
      const supplier = await loadSupplier(req.params.id);

      const result = await paginate(PurchaseOrder, req.query, {
        searchFields: ['poNumber', 'notes'],
        sortable: ['poNumber', 'orderDate', 'grandTotal', 'status', 'createdAt'],
        defaultSort: '-orderDate',
        baseFilter: { supplierId: supplier._id },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
