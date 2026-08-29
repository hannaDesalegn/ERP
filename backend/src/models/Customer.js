// backend/src/models/Customer.js
//
// Mirrors docs/entities.md's Customer entity, field for field. Same names,
// same types, same nullability as the frontend's schema.js and mock.js.

import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: null, trim: true },
    city: { type: String, required: true, trim: true },
    region: { type: String, default: null, trim: true },
    country: { type: String, required: true, minlength: 2, maxlength: 2 },
    postalCode: { type: String, default: null, trim: true },
  },
  { _id: false }, // sub-document, not its own collection
);

const customerSchema = new mongoose.Schema(
  {
    // code is server-generated on create, not client-supplied.
    code: { type: String, required: true, unique: true },

    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['company', 'individual'], required: true },

    tin: { type: String, default: null },
    email: { type: String, default: null, lowercase: true, trim: true },
    phone: { type: String, default: null },
    contactPerson: { type: String, default: null },

    billingAddress: { type: addressSchema, required: true },
    // null = same as billing, per entities.md — not an empty object.
    shippingAddress: { type: addressSchema, default: null },

    // Integer, minor units — never a float. entities.md's non-negotiable rule.
    creditLimit: { type: Number, required: true, min: 0 },
    // Server-calculated — never set directly from a client request body.
    balance: { type: Number, required: true, default: 0 },

    paymentTermsDays: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'ETB' },

    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      required: true,
      default: 'active',
    },

    notes: { type: String, default: null },
  },
  {
    timestamps: true, // gives us createdAt/updatedAt automatically, as ISO dates
  },
);

export const Customer = mongoose.model('Customer', customerSchema);