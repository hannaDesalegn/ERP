import mongoose from 'mongoose';

// PurchaseOrder — C owns this model. Mirrors docs/entities.md § PurchaseOrder.
//
// A PO line is a LineItem plus quantityReceived, which is the one field that
// makes it differ from a sales order line and what drives the
// partially_received status.
const lineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Denormalised at the time the order is placed. If the product is later
    // renamed or repriced, this order must not change — entities.md is explicit
    // that this is standard ERP behaviour and not optional.
    productName: { type: String, required: true },
    sku: { type: String, required: true },

    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 }, // integer, minor units
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },

    // Server-calculated from the four fields above. Never sent by a client.
    lineTotal: { type: Number, required: true },

    // Drives the receive-goods flow and the partially_received status.
    quantityReceived: { type: Number, default: 0, min: 0 },
  },
  // _id stays on: the receive endpoint addresses lines by lineId.
  { _id: true },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    // Human-readable and server-generated, never sent by the client.
    poNumber: { type: String, required: true, unique: true, trim: true },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    supplierName: { type: String, required: true }, // denormalised

    orderDate: { type: String, required: true }, // YYYY-MM-DD
    expectedDate: { type: String, default: null }, // YYYY-MM-DD

    lines: { type: [lineSchema], default: [] },

    // All server-calculated from the lines. entities.md: the UI may show an
    // optimistic preview but never sends totals.
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    currency: { type: String, required: true, uppercase: true },

    // Moves only through the POST actions, never through a PATCH body.
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'approved',
        'partially_received',
        'received',
        'cancelled',
      ],
      default: 'draft',
    },

    notes: { type: String, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });

purchaseOrderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.supplierId = String(ret.supplierId);
    ret.createdBy = String(ret.createdBy);
    ret.approvedBy = ret.approvedBy ? String(ret.approvedBy) : null;

    ret.lines = (ret.lines ?? []).map((line) => ({
      ...line,
      id: String(line._id),
      productId: String(line.productId),
      _id: undefined,
    }));

    delete ret._id;
    return ret;
  },
});

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
