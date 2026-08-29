import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    // The stable identifier the frontend matches on — <RequireRole
    // roles={['admin']}> and every permission check compare against this, not
    // against _id and not against the display name. Renaming a role must not
    // break authorisation, which is why the two are separate fields.
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // The human-readable label, e.g. 'Administrator'. Display only.
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    // Permission strings, "resource.action" — see docs/entities.md.
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// entities.md wants a string `id` and no Mongo internals on the wire.
roleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Role', roleSchema);
