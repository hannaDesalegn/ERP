// backend/src/routes/invoices.js
//
// B owns this file. status can read as "overdue" without ever being stored
// that way — see toResponse() below. Status changes beyond that are POST
// actions (send/record-payment/void), never PATCH.

import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { validateBody } from '../utils/validate.js';
import { paginate } from '../utils/paginate.js';
import { ApiError } from '../middleware/error.js';
import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';

const router = express.Router();

router.use(requireAuth);

// ── Validation ────────────────────────────────────────────────────────────

const lineItemInputSchema = z.object({
  productId: z.string().min(1, 'Choose a product.'),
  quantity: z.number().int().min(1, 'Must be at least 1.'),
  taxPercent: z.number().min(0).max(100),
});

const invoiceCreateSchema = z.object({
  salesOrderId: z.string().nullable(),
  customerId: z.string().min(1, 'Choose a customer.'),
  issueDate: z.string().min(1, 'Pick an issue date.'),
  dueDate: z.string().min(1, 'Pick a due date.'),
  lines: z.array(lineItemInputSchema).min(1, 'Add at least one line item.'),
  currency: z.string().length(3),
  notes: z.string().trim().max(2000).nullable(),
});

const invoiceUpdateSchema = invoiceCreateSchema.partial();

const recordPaymentSchema = z.object({
  amount: z.number().int().min(1, 'Enter a payment amount.'),
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function nextInvoiceNumber() {
  const count = await Invoice.countDocuments();
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Same shape as orders.js's buildLinesAndTotals, minus discount (Invoice has
 * none per entities.md). Throws clearly if Products isn't built yet rather
 * than guessing a price.
 */
async function buildLinesAndTotals(lineInputs) {
  let Product;
  try {
    ({ default: Product } = await import('../models/Product.js'));
  } catch {
    throw ApiError.conflict(
      'Products are not available yet — cannot price invoice lines. Try again once the Products module ships.',
    );
  }

  const lines = [];
  let subtotal = 0;
  let taxTotal = 0;

  for (const input of lineInputs) {
    const product = await Product.findById(input.productId);
    if (!product) throw ApiError.notFound(`Product ${input.productId} not found.`);

    const gross = product.sellingPrice * input.quantity;
    const lineTax = Math.round((gross * input.taxPercent) / 100);
    const lineTotal = gross + lineTax;

    lines.push({
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.sellingPrice,
      quantity: input.quantity,
      taxPercent: input.taxPercent,
      lineTotal,
    });

    subtotal += gross;
    taxTotal += lineTax;
  }

  return { lines, subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}

/**
 * 'overdue' is never stored — it's true past dueDate while money is still
 * owed. Computed here, on the way out, so every response (list and detail)
 * shows it consistently without a background job keeping the database in
 * sync. See entities.md's note that the UI only displays it, never
 * calculates it — this is where that calculation actually happens.
 */
function toResponse(invoiceDoc) {
  const invoice = invoiceDoc.toObject();
  const isUnpaid = invoice.status === 'sent' || invoice.status === 'partially_paid';
  const isPastDue = new Date(invoice.dueDate) < new Date();

  if (isUnpaid && isPastDue && invoice.amountDue > 0) {
    invoice.status = 'overdue';
  }

  return invoice;
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/invoices
router.get('/', requirePermission('invoices.view'), async (req, res, next) => {
  try {
    const result = await paginate(Invoice, req.query, {
      searchFields: ['invoiceNumber', 'customerName'],
      sortable: ['invoiceNumber', 'createdAt', 'dueDate', 'amountDue'],
      defaultSort: '-createdAt',
    });
    result.data = result.data.map(toResponse);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id
router.get('/:id', requirePermission('invoices.view'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found.');
    res.json({ data: toResponse(invoice) });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post(
  '/',
  requirePermission('invoices.create'),
  validateBody(invoiceCreateSchema),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.body.customerId);
      if (!customer) throw ApiError.notFound('Customer not found.');

      const { lines, subtotal, taxTotal, grandTotal } = await buildLinesAndTotals(
        req.body.lines,
      );

      const invoice = await Invoice.create({
        invoiceNumber: await nextInvoiceNumber(),
        salesOrderId: req.body.salesOrderId || null,
        customerId: customer._id,
        customerName: customer.name,
        issueDate: req.body.issueDate,
        dueDate: req.body.dueDate,
        lines,
        subtotal,
        taxTotal,
        grandTotal,
        amountPaid: 0, // payments only ever happen via /record-payment
        currency: req.body.currency,
        status: 'draft',
        notes: req.body.notes,
      });

      res.status(201).json({ data: toResponse(invoice) });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/invoices/:id — details only. Payment and status live below.
router.patch(
  '/:id',
  requirePermission('invoices.edit'),
  validateBody(invoiceUpdateSchema),
  async (req, res, next) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) throw ApiError.notFound('Invoice not found.');

      if (invoice.status !== 'draft') {
        throw ApiError.conflict('Only draft invoices can be edited.');
      }

      if (req.body.customerId) {
        const customer = await Customer.findById(req.body.customerId);
        if (!customer) throw ApiError.notFound('Customer not found.');
        invoice.customerId = customer._id;
        invoice.customerName = customer.name;
      }

      if (req.body.lines) {
        const totals = await buildLinesAndTotals(req.body.lines);
        invoice.lines = totals.lines;
        invoice.subtotal = totals.subtotal;
        invoice.taxTotal = totals.taxTotal;
        invoice.grandTotal = totals.grandTotal;
      }

      const allowed = ['salesOrderId', 'issueDate', 'dueDate', 'currency', 'notes'];
      for (const key of allowed) {
        if (key in req.body) invoice[key] = req.body[key];
      }

      await invoice.save(); // triggers the pre-save amountDue recompute
      res.json({ data: toResponse(invoice) });
    } catch (err) {
      next(err);
    }
  },
);

// ── Status & payment actions ────────────────────────────────────────────

// POST /api/invoices/:id/send — draft -> sent
router.post('/:id/send', requirePermission('invoices.edit'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found.');

    if (invoice.status !== 'draft') {
      throw ApiError.conflict(`Cannot send an invoice in "${invoice.status}" status.`);
    }

    invoice.status = 'sent';
    await invoice.save();
    res.json({ data: toResponse(invoice) });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/record-payment — adds to amountPaid, recomputes
// amountDue, and moves status to partially_paid or paid accordingly.
router.post(
  '/:id/record-payment',
  requirePermission('invoices.edit'),
  validateBody(recordPaymentSchema),
  async (req, res, next) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) throw ApiError.notFound('Invoice not found.');

      if (invoice.status === 'void' || invoice.status === 'draft') {
        throw ApiError.conflict(`Cannot record a payment on a "${invoice.status}" invoice.`);
      }

      if (req.body.amount > invoice.amountDue) {
        throw ApiError.validation(
          { amount: 'Cannot exceed the amount currently due.' },
          'Payment exceeds what is owed.',
        );
      }

      invoice.amountPaid += req.body.amount;
      // amountDue recomputed by the pre-save hook — never set by hand here.
      invoice.status = invoice.amountPaid >= invoice.grandTotal ? 'paid' : 'partially_paid';

      await invoice.save();
      res.json({ data: toResponse(invoice) });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/invoices/:id/void
router.post('/:id/void', requirePermission('invoices.void'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found.');

    if (invoice.status === 'paid') {
      throw ApiError.conflict('A fully paid invoice cannot be voided.');
    }

    invoice.status = 'void';
    await invoice.save();
    res.json({ data: toResponse(invoice) });
  } catch (err) {
    next(err);
  }
});

export default router;