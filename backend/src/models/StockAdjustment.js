import mongoose from 'mongoose';

// StockAdjustment — C owns this model. Mirrors docs/entities.md.
//
// This collection is the audit trail. Stock is never edited by writing a new
// quantityOnHand; it changes only by appending one of these, which is a real
// ERP requirement and the reason the Product model has no stock setter route.
// Nothing here is ever updated or deleted after it is written.
const stockAdjustmentSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Denormalised at the time of the movement. If the product is renamed
    // later, the history must still read as it did when it happened.
    productName: { type: String, required: true },

    direction: {
      type: String,
      enum: ['increase', 'decrease'],
      required: true,
    },

    quantity: { type: Number, required: true, min: 0 },

    reason: {
      type: String,
      enum: ['purchase', 'sale', 'damage', 'loss', 'count_correction', 'return'],
      required: true,
    },

    reference: { type: String, default: null },
    notes: { type: String, default: null },

    // Server-set from the session, never from the body.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  // updatedAt is meaningless on an append-only record, but timestamps gives
  // createdAt which the history is sorted by.
  { timestamps: true },
);

// The history endpoint always filters by product and sorts newest first.
stockAdjustmentSchema.index({ productId: 1, createdAt: -1 });

stockAdjustmentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.productId = String(ret.productId);
    ret.createdBy = String(ret.createdBy);
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('StockAdjustment', stockAdjustmentSchema);
