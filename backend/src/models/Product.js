import mongoose from 'mongoose';

// Product — C owns this model. Mirrors docs/entities.md § Product field for
// field: same names, same types, same nullability.
//
// Money is an integer in minor units, never a float. Quantities are plain
// numbers and may carry decimals (2.5 kg) — they are not money.
const productSchema = new mongoose.Schema(
  {
    // Human-readable and server-generated, never sent by the client.
    sku: { type: String, required: true, unique: true, trim: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    // Denormalised for display, kept in step by the route on create and patch.
    categoryName: { type: String, default: null },

    unitOfMeasure: {
      type: String,
      enum: ['pcs', 'kg', 'ltr', 'box'],
      required: true,
    },

    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },

    // Stock changes only through a StockAdjustment, never by a direct write —
    // entities.md § Product. The routes enforce that; these have no setter path
    // from any request body.
    quantityOnHand: { type: Number, default: 0 },
    quantityReserved: { type: Number, default: 0 },

    // Server-calculated, but STORED rather than virtual. entities.md calls it
    // server-calculated and it is — the client never sends it — but Mongo
    // cannot sort or filter on a Mongoose virtual, and the list endpoint has to
    // do both (a sortable column, and ?lowStock=true). Kept in step by the
    // pre-save hook below, and by incrementing it alongside quantityOnHand in
    // the adjustment route, so the two cannot drift.
    quantityAvailable: { type: Number, default: 0 },

    reorderLevel: { type: Number, default: 0, min: 0 },

    barcode: { type: String, default: null },
    imageUrl: { type: String, default: null },

    status: {
      type: String,
      enum: ['active', 'discontinued'],
      default: 'active',
    },
  },
  { timestamps: true },
);

// Searching by sku or name is what the list endpoint does on every keystroke.
productSchema.index({ name: 1 });
// ?lowStock=true compares these two on every product.
productSchema.index({ quantityAvailable: 1, reorderLevel: 1 });

// The single definition of the derived quantity, applied on every document
// save. The adjustment route uses an atomic  on both fields instead, for
// the concurrency reason explained there.
productSchema.pre('save', function syncAvailable(next) {
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved;
  next();
});

productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    // entities.md: ids are strings on the wire.
    ret.categoryId = String(ret.categoryId);
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Product', productSchema);
