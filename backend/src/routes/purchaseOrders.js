// Purchase order routes — C owns this file.
//
// Two rules from backend-plan.md §5 shape everything here:
//
//   1. Status changes are POST actions, not PATCH. Each transition has its own
//      permission and its own preconditions, and none of them can be reached by
//      putting a status field in a request body — the schemas strip it.
//   2. Totals are calculated server-side, always, from the line items. A total
//      that arrives in a body is ignored.
//
// Receiving goods is the one place this module writes to another module's data:
// it increases product stock. It does that by appending StockAdjustment records
// rather than writing quantityOnHand directly, so the audit trail entities.md
// requires stays complete no matter which route moved the stock.

import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { requirePermission } from '../middleware/permissions.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Supplier from '../models/Supplier.js';
import { paginate } from '../utils/paginate.js';
import { nextNumber } from '../utils/sequence.js';
import { calculateLineTotal, calculateTotals } from '../utils/totals.js';
import { validateBody } from '../utils/validate.js';
import {
  purchaseOrderCreateSchema,
  purchaseOrderUpdateSchema,
  receiveGoodsSchema,
} from '../validation/purchaseOrders.js';

const router = express.Router();

router.use(requireAuth);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const SEARCH_FIELDS = ['poNumber', 'supplierName', 'notes'];

const SORTABLE = [
  'poNumber',
  'supplierName',
  'orderDate',
  'expectedDate',
  'grandTotal',
  'status',
  'createdAt',
];

/**
 * The status machine, written out as data rather than scattered through the
 * handlers. Anything not listed here is not a legal move and answers 409.
 *
 *   draft → pending_approval → approved → partially_received → received
 *
 * cancelled is reachable from any state before the goods arrive. Once a
 * delivery has been recorded the order is no longer cancellable — the stock is
 * already on the shelf and cancelling would leave it unaccounted for.
 */
const ALLOWED_FROM = {
  submit: ['draft'],
  approve: ['pending_approval'],
  receive: ['approved', 'partially_received'],
  cancel: ['draft', 'pending_approval', 'approved'],
};

/** Editing is only legal while nobody has approved anything yet. */
const EDITABLE_STATUSES = ['draft'];

/** Loads an order by id, or throws the 404 the contract specifies. */
async function loadOrder(id) {
  if (!OBJECT_ID.test(id)) throw ApiError.notFound('Purchase order not found.');

  const order = await PurchaseOrder.findById(id);
  if (!order) throw ApiError.notFound('Purchase order not found.');

  return order;
}

/** Guards a transition, with a message that says what state the order is in. */
function assertTransition(order, action) {
  if (!ALLOWED_FROM[action].includes(order.status)) {
    throw ApiError.conflict(
      `Cannot ${action} an order that is ${order.status.replace(/_/g, ' ')}.`,
    );
  }
}

/**
 * Turns validated line input into stored lines: looks each product up, copies
 * its name and sku onto the line, and computes the line total.
 *
 * The denormalisation is the point. entities.md is explicit that if a product
 * is later renamed or repriced, a historical order must not change — so the
 * name, sku and price are captured here, at the time the order is placed, and
 * never re-read from the product afterwards.
 */
async function buildLines(inputLines) {
  const ids = [...new Set(inputLines.map((line) => line.productId))];
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const fields = {};

  const lines = inputLines.map((line, index) => {
    const product = byId.get(line.productId);

    if (!product) {
      // Indexed path, so React Hook Form puts the message on the right row.
      fields[`lines.${index}.productId`] = 'Choose a product.';
      return null;
    }

    return {
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      lineTotal: calculateLineTotal(line),
      quantityReceived: 0,
    };
  });

  if (Object.keys(fields).length) throw ApiError.validation(fields);

  return lines;
}

// ── The five verbs ───────────────────────────────────────────────────────────

router.get(
  '/',
  requirePermission('purchasing.view'),
  async (req, res, next) => {
    try {
      const baseFilter = {};

      // Module-specific filter, same pattern as products.
      if (OBJECT_ID.test(req.query.supplierId ?? '')) {
        baseFilter.supplierId = req.query.supplierId;
      }

      const result = await paginate(PurchaseOrder, req.query, {
        searchFields: SEARCH_FIELDS,
        sortable: SORTABLE,
        defaultSort: '-orderDate',
        baseFilter: Object.keys(baseFilter).length ? baseFilter : undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  requirePermission('purchasing.view'),
  async (req, res, next) => {
    try {
      res.json({ data: await loadOrder(req.params.id) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requirePermission('purchasing.create'),
  validateBody(purchaseOrderCreateSchema),
  async (req, res, next) => {
    try {
      const supplier = await Supplier.findById(req.body.supplierId);
      if (!supplier) {
        throw ApiError.validation({ supplierId: 'Choose a supplier.' });
      }

      const lines = await buildLines(req.body.lines);
      const totals = calculateTotals(lines);

      const order = await PurchaseOrder.create({
        supplierId: supplier._id,
        supplierName: supplier.name, // denormalised
        orderDate: req.body.orderDate,
        expectedDate: req.body.expectedDate,
        currency: req.body.currency,
        notes: req.body.notes,
        lines,
        ...totals,
        // Always starts as a draft. The only way out is a POST action.
        status: 'draft',
        poNumber: await nextNumber(
          PurchaseOrder,
          'poNumber',
          (n) => `PO-${new Date().getFullYear()}-${n}`,
        ),
        createdBy: req.user._id,
      });

      res
        .status(201)
        .location(`/api/purchase-orders/${order.id}`)
        .json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('purchasing.edit'),
  validateBody(purchaseOrderUpdateSchema),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id);

      // The frontend hides the edit button once an order leaves draft. That is
      // UX; this is the control — security-notes.md §2.
      if (!EDITABLE_STATUSES.includes(order.status)) {
        throw ApiError.conflict(
          `Only a draft can be edited. This order is ${order.status.replace(/_/g, ' ')}.`,
        );
      }

      if (req.body.supplierId !== undefined) {
        const supplier = await Supplier.findById(req.body.supplierId);
        if (!supplier) {
          throw ApiError.validation({ supplierId: 'Choose a supplier.' });
        }
        order.supplierId = supplier._id;
        order.supplierName = supplier.name;
      }

      for (const field of ['orderDate', 'expectedDate', 'currency', 'notes']) {
        if (req.body[field] !== undefined) order[field] = req.body[field];
      }

      // Replacing the lines re-derives every total. There is no path where a
      // total comes from the request.
      if (req.body.lines !== undefined) {
        order.lines = await buildLines(req.body.lines);
      }

      const totals = calculateTotals(order.lines);
      Object.assign(order, totals);

      await order.save();
      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// api-contract.md §4 lists no DELETE for purchase orders — an order that
// existed is a record, and the way to stop one is /cancel. Deliberately absent
// rather than forgotten.

// ── Status actions ───────────────────────────────────────────────────────────

router.post(
  '/:id/submit',
  requirePermission('purchasing.edit'),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id);
      assertTransition(order, 'submit');

      // An empty order should never reach an approver.
      if (order.lines.length === 0) {
        throw ApiError.conflict('Add at least one line before submitting.');
      }

      order.status = 'pending_approval';
      await order.save();

      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/approve',
  requirePermission('purchasing.approve'),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id);
      assertTransition(order, 'approve');

      // Whoever approved it is part of the record, not a display detail — this
      // is the field people ask about months later.
      order.status = 'approved';
      order.approvedBy = req.user._id;
      await order.save();

      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/cancel',
  requirePermission('purchasing.edit'),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id);
      assertTransition(order, 'cancel');

      order.status = 'cancelled';
      await order.save();

      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Receive goods. The one route in C's set that changes another module's data.
 *
 * For each line the body names, it records what actually arrived, then moves
 * that quantity into stock as a StockAdjustment — never by writing
 * quantityOnHand directly. The order becomes `received` once every line is
 * complete, and `partially_received` while any line is short.
 */
router.post(
  '/:id/receive',
  requirePermission('purchasing.receive'),
  validateBody(receiveGoodsSchema),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id);
      assertTransition(order, 'receive');

      const fields = {};
      const movements = [];

      req.body.lines.forEach((entry, index) => {
        const line = order.lines.id(entry.lineId);

        if (!line) {
          fields[`lines.${index}.lineId`] = 'That line is not on this order.';
          return;
        }

        const outstanding = line.quantity - line.quantityReceived;

        // Receiving more than was ordered is how phantom stock appears. Refuse
        // it and say what is actually outstanding.
        if (entry.quantityReceived > outstanding) {
          fields[`lines.${index}.quantityReceived`] =
            `Only ${outstanding} of ${line.quantity} are still outstanding.`;
          return;
        }

        if (entry.quantityReceived > 0) {
          movements.push({ line, quantity: entry.quantityReceived });
        }
      });

      if (Object.keys(fields).length) throw ApiError.validation(fields);

      if (movements.length === 0) {
        throw ApiError.validation({
          'lines.0.quantityReceived': 'Record at least one quantity above zero.',
        });
      }

      // Stock first: if a product has been deleted underneath us, nothing on
      // the order has changed yet and the whole receipt fails cleanly.
      for (const movement of movements) {
        const product = await Product.findOneAndUpdate(
          { _id: movement.line.productId },
          {
            $inc: {
              quantityOnHand: movement.quantity,
              quantityAvailable: movement.quantity,
            },
          },
          { new: true },
        );

        if (!product) {
          throw ApiError.conflict(
            `${movement.line.productName} no longer exists, so this delivery cannot be recorded.`,
          );
        }

        await StockAdjustment.create({
          productId: product._id,
          productName: product.name,
          direction: 'increase',
          quantity: movement.quantity,
          reason: 'purchase',
          // The audit trail points back at the order that moved the stock.
          reference: order.poNumber,
          notes: null,
          createdBy: req.user._id,
        });

        movement.line.quantityReceived += movement.quantity;
      }

      const complete = order.lines.every(
        (line) => line.quantityReceived >= line.quantity,
      );

      order.status = complete ? 'received' : 'partially_received';
      await order.save();

      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
