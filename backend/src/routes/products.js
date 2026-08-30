// Product routes — C owns this file.
//
// ROUTE ORDER MATTERS, exactly as it does in the MSW handlers: Express matches
// top to bottom, so the literal /categories must be declared before /:id or
// "categories" is read as an id and the endpoint is unreachable.
//
// Every route carries requirePermission, including the GETs — backend-plan.md
// §6 item 2, deny by default.
//
// On object-level checks (§6 item 3): entities.md gives Product no owner or
// tenant field, so there is no "may this user see *this* product?" question to
// ask — visibility is the route-level permission and nothing narrower. Said out
// loud rather than left as a silent omission, because a missing object-level
// check is the one that gets skipped by accident.

import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { requirePermission } from '../middleware/permissions.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { paginate } from '../utils/paginate.js';
import { nextNumber } from '../utils/sequence.js';
import { validateBody } from '../utils/validate.js';
import {
  categoryCreateSchema,
  productCreateSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from '../validation/products.js';

const router = express.Router();

// Everything below requires a signed-in user.
router.use(requireAuth);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const SEARCH_FIELDS = ['sku', 'name', 'categoryName', 'barcode'];

const SORTABLE = [
  'sku',
  'name',
  'categoryName',
  'costPrice',
  'sellingPrice',
  'quantityAvailable',
  'status',
  'createdAt',
];

const ALLOWED_PATCH_FIELDS = [
  'name',
  'description',
  'categoryId',
  'unitOfMeasure',
  'costPrice',
  'sellingPrice',
  'currency',
  'reorderLevel',
  'barcode',
  'imageUrl',
  'status',
];

/** Loads a product by id, or throws the 404 the contract specifies. */
async function loadProduct(id) {
  // An id of the wrong shape is a 404, not a 500 from a failed cast.
  if (!OBJECT_ID.test(id)) throw ApiError.notFound('Product not found.');

  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found.');

  return product;
}

// ── Categories — literal path, declared before /:id ──────────────────────────

router.get(
  '/categories',
  requirePermission('products.view'),
  async (req, res, next) => {
    try {
      const categories = await Category.find().sort({ name: 1 });
      res.json({ data: categories });
    } catch (err) {
      next(err);
    }
  },
);

// Not in api-contract.md, but the product form cannot work without a way to get
// categories in. Raised in the group chat; the contract gets the row if it stays.
router.post(
  '/categories',
  requirePermission('products.create'),
  validateBody(categoryCreateSchema),
  async (req, res, next) => {
    try {
      const existing = await Category.findOne({ name: req.body.name });
      if (existing) {
        throw ApiError.conflict(
          `The category "${req.body.name}" already exists.`,
        );
      }

      const category = await Category.create(req.body);

      res
        .status(201)
        .location(`/api/products/categories/${category.id}`)
        .json({ data: category });
    } catch (err) {
      next(err);
    }
  },
);

// ── The five verbs ───────────────────────────────────────────────────────────

router.get('/', requirePermission('products.view'), async (req, res, next) => {
  try {
    // Module-specific filters (api-contract.md §2 allows these) go through
    // baseFilter, which paginate $ands with the standard ones so a client
    // cannot overwrite them from the query string.
    const baseFilter = {};

    if (OBJECT_ID.test(req.query.categoryId ?? '')) {
      baseFilter.categoryId = req.query.categoryId;
    }

    if (['pcs', 'kg', 'ltr', 'box'].includes(req.query.unitOfMeasure)) {
      baseFilter.unitOfMeasure = req.query.unitOfMeasure;
    }

    // Compares two fields of the same document, which needs $expr.
    if (req.query.lowStock === 'true') {
      baseFilter.$expr = { $lte: ['$quantityAvailable', '$reorderLevel'] };
    }

    const result = await paginate(Product, req.query, {
      searchFields: SEARCH_FIELDS,
      sortable: SORTABLE,
      defaultSort: 'sku',
      baseFilter: Object.keys(baseFilter).length ? baseFilter : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/:id',
  requirePermission('products.view'),
  async (req, res, next) => {
    try {
      res.json({ data: await loadProduct(req.params.id) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requirePermission('products.create'),
  validateBody(productCreateSchema),
  async (req, res, next) => {
    try {
      const category = await Category.findById(req.body.categoryId);
      if (!category) {
        throw ApiError.validation({ categoryId: 'Choose a category.' });
      }

      const product = await Product.create({
        ...req.body,
        // Server-generated. The schema strips these from the body, so the only
        // place they can come from is here.
        sku: await nextNumber(Product, 'sku', (n) => `PRD-${n}`),
        categoryName: category.name,
        // A new product starts with no stock. It gains stock only through an
        // adjustment — entities.md § Product.
        quantityOnHand: 0,
        quantityReserved: 0,
      });

      res
        .status(201)
        .location(`/api/products/${product.id}`)
        .json({ data: product });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('products.edit'),
  validateBody(productUpdateSchema),
  async (req, res, next) => {
    try {
      const product = await loadProduct(req.params.id);

      // Field by field rather than Object.assign(product, req.body) —
      // security-notes.md §4. Zod has already stripped unknown keys; this is
      // the second layer, and the one that survives the schema being loosened.
      for (const field of ALLOWED_PATCH_FIELDS) {
        if (req.body[field] !== undefined) product[field] = req.body[field];
      }

      // categoryName is denormalised, so the server re-derives it rather than
      // trusting the client to keep the pair consistent.
      if (req.body.categoryId !== undefined) {
        const category = await Category.findById(req.body.categoryId);
        if (!category) {
          throw ApiError.validation({ categoryId: 'Choose a category.' });
        }
        product.categoryName = category.name;
      }

      await product.save();
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requirePermission('products.delete'),
  async (req, res, next) => {
    try {
      const product = await loadProduct(req.params.id);

      // Soft deletes are out of scope (backend-plan.md §7), so this is a real
      // delete — which makes it worth refusing when it would orphan a live
      // reference. A product on an order that has not finished is exactly that.
      const openLine = await PurchaseOrder.exists({
        'lines.productId': product._id,
        status: { $nin: ['received', 'cancelled'] },
      });

      if (openLine) {
        throw ApiError.conflict(
          'This product is on a purchase order that is still open. Cancel or receive that order first.',
        );
      }

      await product.deleteOne();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ── Stock adjustments — the only way stock changes ───────────────────────────

router.get(
  '/:id/adjustments',
  requirePermission('products.view'),
  async (req, res, next) => {
    try {
      const product = await loadProduct(req.params.id);

      const result = await paginate(StockAdjustment, req.query, {
        searchFields: ['reason', 'reference', 'notes'],
        sortable: ['createdAt', 'quantity', 'direction', 'reason'],
        defaultSort: '-createdAt',
        baseFilter: { productId: product._id },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/adjustments',
  requirePermission('products.adjust_stock'),
  validateBody(stockAdjustmentSchema),
  async (req, res, next) => {
    try {
      const product = await loadProduct(req.params.id);

      const delta =
        req.body.direction === 'increase'
          ? req.body.quantity
          : -req.body.quantity;

      // Read-then-write would let two concurrent decreases both pass a
      // "do we have enough?" check and drive stock negative. This moves the
      // check into the update itself: the document only matches while it still
      // holds the stock, so the loser of a race gets null and a 409.
      //
      // quantityAvailable is incremented by the same delta rather than
      // recomputed, which keeps it exact without a second round trip. The
      // pre-save hook on the model covers every other write path.
      const guard =
        delta < 0 ? { quantityOnHand: { $gte: req.body.quantity } } : {};

      const updated = await Product.findOneAndUpdate(
        { _id: product._id, ...guard },
        { $inc: { quantityOnHand: delta, quantityAvailable: delta } },
        { new: true },
      );

      if (!updated) {
        // Well-formed body, impossible against the current state — 409, not 422.
        throw ApiError.conflict(
          `Cannot remove ${req.body.quantity} — only ${product.quantityOnHand} in stock.`,
        );
      }

      const adjustment = await StockAdjustment.create({
        ...req.body,
        productId: updated._id,
        // Denormalised at the time of the movement, and server-set from the
        // session — never from the body.
        productName: updated.name,
        createdBy: req.user._id,
      });

      res
        .status(201)
        .location(`/api/products/${updated.id}/adjustments/${adjustment.id}`)
        .json({ data: adjustment });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
