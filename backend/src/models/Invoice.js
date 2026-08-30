// backend/src/models/Invoice.js
//
// Mirrors docs/entities.md's Invoice entity. amountDue is ALWAYS derived
// (grandTotal - amountPaid) — never stored as an independently editable
// number, same rule as the frontend's schema.js.

import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true }, // denormalised, frozen
    sku: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },

    quantity: { type: Number, required: true, min: 1 },
    taxPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },

    lineTotal: { type: Number, required: true, min: 0 }, // server-calculated
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },

    // Not every invoice comes from an order — walk-in sales exist.
    salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', default: null },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true }, // denormalised

    issueDate: { type: String, required: true }, // YYYY-MM-DD
    dueDate: { type: String, required: true },

    lines: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'An invoice needs at least one line item.',
      },
    },

    // Server-calculated — never accepted from a client body.
    subtotal: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },

    // amountPaid is the one money field a client legitimately sets, via the
    // /record-payment action — never through a plain PATCH.
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    // Always grandTotal - amountPaid. Recomputed on every save via the
    // pre-save hook below — never trust a value sent for this field.
    amountDue: { type: Number, required: true, default: 0 },

    currency: { type: String, required: true, default: 'ETB' },

    // 'overdue' excluded here on purpose — see the virtual/status logic in
    // routes/invoices.js. Stored status only tracks the workflow states a
    // person actually chooses or triggers.
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'void'],
      required: true,
      default: 'draft',
    },

    notes: { type: String, default: null },
  },
  { timestamps: true },
);

// amountDue must never drift from grandTotal - amountPaid, even if a future
// code path forgets to recompute it by hand. One place, always correct.
invoiceSchema.pre('save', function computeAmountDue(next) {
  this.amountDue = this.grandTotal - this.amountPaid;
  next();
});

export const Invoice = mongoose.model('Invoice', invoiceSchema);