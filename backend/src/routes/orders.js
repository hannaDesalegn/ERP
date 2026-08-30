// backend/src/routes/orders.js
//
// B owns this file. Status changes are POST actions (submit/approve/cancel),
// never PATCH — see docs/backend-plan.md §5. Totals are always recalculated
// here from the line items; a client-sent total is never trusted or stored.

import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { validateBody } from '../utils/validate.js';
import { paginate } from '../utils/paginate.js';
import { ApiError } from '../middleware/error.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';

const router = express.Router();

router.use(requireAuth);

// ── Validation ────────────────────────────────────────────────────────────
// Mirrors the frontend's schema.js. productName/sku/unitPrice/lineTotal are
// absent here on purpose — the server looks those up and computes them,
// never trusts a client's copy of a product's price.

const lineItemInputSchema = z.object({
  productId: z.string().min(1, 'Choose a product.'),
  quantity: z.number().int().min(1, 'Must be at least 1.'),
  discountPercent: z.number().min(0).max(100),
  taxPercent: z.number().min(0).max(100),
});

const orderCreateSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),
  orderDate: z.string().min(1, 'Pick an order date.'),
  expectedDeliveryDate: z.string().nullable().or(z.literal('').transform(() => null)),
  lines: z.array(lineItemInputSchema).min(1, 'Add at least one line item.'),
  currency: z.string().length(3),
  notes: z.string().trim().max(2000).nullable(),
});

const orderUpdateSchema = orderCreateSchema.partial();

// ── Helpers ───────────────────────────────────────────────────────────────

async function nextOrderNumber() {
  const count = await SalesOrder.countDocuments();
  const year = new Date().getFullYear();
  return `SO-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Takes the client's line input (productId/quantity/discount/tax only), looks
 * up each product's current name/sku/price, and returns full line objects
 * plus the four order-level totals. This is the ONLY place order totals are
 * calculated — never trust one sent in a request body.
 *
 * NOTE: Product model doesn't exist yet (C's module). Until it does, this
 * throws a clear error rather than silently guessing a price — a wrong total
 * on a real order is worse than a blocked request.
 */
async function buildLinesAndTotals(lineInputs) {
  let Product;
  try {
    ({ Product } = await import('../models/Product.js'));
  } catch {
    throw ApiError.conflict(
      'Products are not available yet — cannot price order lines. Try again once the Products module ships.',
    );
  }

  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const input of lineInputs) {
    const product = await Product.findById(input.productId);
    if (!product) throw ApiError.notFound(`Product ${input.productId} not found.`);

    const gross = product.unitPrice * input.quantity;
    const lineDiscount = Math.round((gross * input.discountPercent) / 100);
    const afterDiscount = gross - lineDiscount;
    const lineTax = Math.round((afterDiscount * input.taxPercent) / 100);
    const lineTotal = afterDiscount + lineTax;

    lines.push({
      productId: product._id,
      productName: product.name, // denormalised now, frozen from here on
      sku: product.sku,
      unitPrice: product.unitPrice,
      quantity: input.quantity,
      discountPercent: input.discountPercent,
      taxPercent: input.taxPercent,
      lineTotal,
    });

    subtotal += gross;
    discountTotal += lineDiscount;
    taxTotal += lineTax;
  }

  const grandTotal = subtotal - discountTotal + taxTotal;
  return { lines, subtotal, discountTotal, taxTotal, grandTotal };
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/orders
router.get('/', requirePermission('orders.view'), async (req, res, next) => {
  try {
    const result = await paginate(SalesOrder, req.query, {
      searchFields: ['orderNumber', 'customerName'],
      sortable: ['orderNumber', 'createdAt', 'grandTotal'],
      defaultSort: '-createdAt',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get('/:id', requirePermission('orders.view'), async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found.');
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
router.post(
  '/',
  requirePermission('orders.create'),
  validateBody(orderCreateSchema),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.body.customerId);
      if (!customer) throw ApiError.notFound('Customer not found.');

      const { lines, subtotal, discountTotal, taxTotal, grandTotal } =
        await buildLinesAndTotals(req.body.lines);

      const order = await SalesOrder.create({
        orderNumber: await nextOrderNumber(),
        customerId: customer._id,
        customerName: customer.name, // denormalised
        orderDate: req.body.orderDate,
        expectedDeliveryDate: req.body.expectedDeliveryDate,
        lines,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        currency: req.body.currency,
        status: 'draft', // every order starts as draft, never client-chosen
        notes: req.body.notes,
        createdBy: req.user._id,
        approvedBy: null,
      });

      res.status(201).json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/orders/:id — editing details, NOT status. See the action
// endpoints below for status changes.
router.patch(
  '/:id',
  requirePermission('orders.edit'),
  validateBody(orderUpdateSchema),
  async (req, res, next) => {
    try {
      const order = await SalesOrder.findById(req.params.id);
      if (!order) throw ApiError.notFound('Order not found.');

      // Editing line items or the customer on anything but a draft risks
      // rewriting an order someone already approved. Keep the door narrow.
      if (order.status !== 'draft') {
        throw ApiError.conflict('Only draft orders can be edited.');
      }

      if (req.body.customerId) {
        const customer = await Customer.findById(req.body.customerId);
        if (!customer) throw ApiError.notFound('Customer not found.');
        order.customerId = customer._id;
        order.customerName = customer.name;
      }

      if (req.body.lines) {
        const totals = await buildLinesAndTotals(req.body.lines);
        order.lines = totals.lines;
        order.subtotal = totals.subtotal;
        order.discountTotal = totals.discountTotal;
        order.taxTotal = totals.taxTotal;
        order.grandTotal = totals.grandTotal;
      }

      // Allow-list the remaining plain fields explicitly.
      const allowed = ['orderDate', 'expectedDeliveryDate', 'currency', 'notes'];
      for (const key of allowed) {
        if (key in req.body) order[key] = req.body[key];
      }

      await order.save();
      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/orders/:id
router.delete('/:id', requirePermission('orders.delete'), async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found.');

    if (order.status !== 'draft') {
      throw ApiError.conflict('Only draft orders can be deleted. Cancel it instead.');
    }

    await order.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Status actions ───────────────────────────────────────────────────────
// One endpoint per meaningful transition. Each checks its own permission and
// the order's CURRENT status before allowing the change — this is what a
// PATCH { status: '...' } cannot enforce.

// POST /api/orders/:id/submit — draft -> pending_approval
router.post('/:id/submit', requirePermission('orders.edit'), async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found.');

    if (order.status !== 'draft') {
      throw ApiError.conflict(`Cannot submit an order in "${order.status}" status.`);
    }

    order.status = 'pending_approval';
    await order.save();
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/approve — pending_approval -> approved
router.post('/:id/approve', requirePermission('orders.approve'), async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found.');

    if (order.status !== 'pending_approval') {
      throw ApiError.conflict(`Cannot approve an order in "${order.status}" status.`);
    }

    order.status = 'approved';
    order.approvedBy = req.user._id;
    await order.save();
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/cancel — any status before 'fulfilled' -> cancelled
router.post('/:id/cancel', requirePermission('orders.edit'), async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found.');

    if (order.status === 'fulfilled' || order.status === 'cancelled') {
      throw ApiError.conflict(`Cannot cancel an order in "${order.status}" status.`);
    }

    order.status = 'cancelled';
    await order.save();
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

export default router;