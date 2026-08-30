// backend/src/models/SalesOrder.js
//
// Mirrors docs/entities.md's SalesOrder entity. Totals are always
// server-calculated — this file owns that math, nowhere else does.

import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Denormalised at the moment the line is added — frozen even if the
    // product's name or price changes later. Never looked up live.
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 }, // integer, minor units

    quantity: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    taxPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },

    // Server-calculated on every save — see computeTotals in routes/orders.js.
    // Stored (not derived on read) so historical orders don't silently change
    // if the calculation logic changes later.
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }, // each line needs its own id for the frontend's key prop
);

const salesOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true }, // denormalised

    orderDate: { type: String, required: true }, // YYYY-MM-DD, per entities.md
    expectedDeliveryDate: { type: String, default: null },

    lines: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'An order needs at least one line item.',
      },
    },

    // All four server-calculated — never accepted from a client request body.
    subtotal: { type: Number, required: true, default: 0 },
    discountTotal: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },

    currency: { type: String, required: true, default: 'ETB' },

    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'fulfilled', 'cancelled'],
      required: true,
      default: 'draft',
    },

    notes: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);