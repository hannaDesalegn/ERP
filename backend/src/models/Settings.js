import mongoose from 'mongoose';

// The application's one settings document. There is no Settings typedef in
// docs/entities.md — the shape here is the one the Settings page already reads,
// field for field, from frontend/src/mocks/settingsHandlers.js.

/**
 * A singleton enforced by the database rather than by convention. `key` is
 * always 'global' and unique, so a second document is an E11000 rather than a
 * silently-created row that findOne() might return instead of the real one.
 * Nothing outside this file mentions the field, and toJSON strips it.
 */
const SINGLETON_KEY = 'global';

// entities.md § Address — the same six fields, null for missing, never an empty
// string. _id: false because this is a value object, not a subdocument anyone
// addresses on its own; without it Mongo stores an id the contract never shows.
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: null, trim: true },
    line2: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    region: { type: String, default: null, trim: true },
    country: { type: String, default: null, trim: true }, // ISO 3166-1 alpha-2
    postalCode: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },

    companyName: { type: String, required: true, trim: true },
    companyAddress: { type: addressSchema, default: () => ({}) },
    defaultCurrency: { type: String, required: true }, // ISO 4217
    defaultPaymentTermsDays: { type: Number, required: true, min: 0, max: 365 },
    invoiceNumberPrefix: { type: String, required: true },
    defaultReorderLevel: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

/**
 * What a fresh install starts with. Deliberately not the mock's seed values —
 * those name a company that doesn't exist, and this document is created in a
 * real database on first read rather than by the seed script. The address is
 * empty so the page shows blank inputs to fill in; the four defaults below are
 * the mock's, which are reasonable rather than invented.
 */
const DEFAULTS = {
  companyName: 'Your Company',
  companyAddress: {
    line1: null,
    line2: null,
    city: null,
    region: null,
    country: null,
    postalCode: null,
  },
  defaultCurrency: 'ETB',
  defaultPaymentTermsDays: 30,
  invoiceNumberPrefix: 'INV',
  defaultReorderLevel: 10,
};

/**
 * The settings document, created on first call. GET must answer something
 * before anyone has ever PATCHed, and an upsert keeps that from being a
 * special case every caller has to remember.
 */
settingsSchema.statics.load = async function load() {
  return this.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $setOnInsert: { key: SINGLETON_KEY, ...DEFAULTS } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

// A singleton has no id and no collection semantics on the wire, so this emits
// exactly the seven fields the Settings page reads — the six editable ones plus
// the server-managed updatedAt. createdAt and the singleton key are internal.
settingsSchema.set('toJSON', {
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    delete ret.key;
    delete ret.createdAt;
    return ret;
  },
});

export default mongoose.model('Settings', settingsSchema);
