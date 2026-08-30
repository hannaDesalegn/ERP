import mongoose from 'mongoose';

// Supplier — C owns this model. Mirrors docs/entities.md § Supplier.
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    region: { type: String, default: null },
    country: { type: String, default: null }, // ISO 3166-1 alpha-2
    postalCode: { type: String, default: null },
  },
  { _id: false },
);

const supplierSchema = new mongoose.Schema(
  {
    // Human-readable and server-generated, never sent by the client.
    code: { type: String, required: true, unique: true, trim: true },

    name: { type: String, required: true, trim: true },
    tin: { type: String, default: null },
    email: { type: String, default: null, lowercase: true, trim: true },
    phone: { type: String, default: null },
    contactPerson: { type: String, default: null },

    address: { type: addressSchema, default: () => ({}) },

    paymentTermsDays: { type: Number, default: 30, min: 0, max: 365 },
    currency: { type: String, required: true, uppercase: true },

    // What we owe them. Derived from received purchase orders and payments, so
    // it is server-calculated and absent from every request schema — a client
    // that could set this could write off a debt from the browser.
    balance: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    notes: { type: String, default: null },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 1 });

supplierSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Supplier', supplierSchema);
