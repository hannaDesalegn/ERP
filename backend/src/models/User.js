import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// roleId below refs 'Role' by name, and populate() resolves that name through
// Mongoose's model registry — so Role must have been imported before any
// populate runs, or it throws MissingSchemaError. Importing it here ties that to
// the schema declaring the ref instead of leaving every caller to remember.
import './Role.js';

// security-notes.md §4: bcrypt cost 12 or higher.
export const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false — the hash never comes back from a query unless asked for
    // explicitly, so it can't leak through a res.json of a user document.
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    status: { type: String, enum: ['active', 'invited', 'suspended'], default: 'invited' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Hash on save, only when the password actually changed — otherwise every
// unrelated update would re-hash the hash.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  next();
});

// Needs a document loaded with .select('+password').
userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

// entities.md User shape. roleName and permissions are denormalised from the
// role, so roleId must be populated (requireAuth does this) or they come back
// null/empty rather than wrong.
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    const role = doc.populated('roleId') ? doc.roleId : null;

    ret.roleId = role ? role.id : String(ret.roleId);
    ret.roleName = role ? role.name : null;
    ret.permissions = role ? role.permissions : [];

    delete ret._id;
    delete ret.password; // belt and braces; select:false already omits it
    return ret;
  },
});

export default mongoose.model('User', userSchema);
