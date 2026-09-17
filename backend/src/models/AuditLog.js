/**
 * Audit log.
 *
 * docs/security-notes.md §4 calls this non-negotiable for an ERP: "who, what,
 * when, before, after", because approvals and stock adjustments are exactly the
 * things people dispute afterwards.
 *
 * KNOWN LIMITATION: this records the request
 * and the resulting state, not the prior state. Capturing "before" means
 * reading each record ahead of the write, which only the individual route
 * handler can do, and doing that would mean editing every write route in all
 * three owners' files. The approach here captures who did what, to which
 * record, when, and what they sent, from one place. A true before-and-after
 * diff is the next step, not this one.
 *
 * Entries are never updated or deleted by the application. There is no endpoint
 * that writes to this collection other than the middleware that appends to it.
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    // Who. Denormalised alongside the reference, because an audit entry has to
    // stay readable after the account is renamed or removed.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userEmail: { type: String, default: null },
    roleName: { type: String, default: null },

    // What.
    method: { type: String, required: true },
    path: { type: String, required: true },
    resource: { type: String, required: true },
    action: { type: String, required: true },
    recordId: { type: String, default: null },

    // Outcome. Failed attempts are recorded too: a rejected approval is often
    // more interesting than a successful one.
    statusCode: { type: Number, required: true },
    outcome: { type: String, enum: ['success', 'failure'], required: true },

    // What they sent, with secrets removed. Capped in size so a large line-item
    // payload cannot bloat the collection.
    requestBody: { type: mongoose.Schema.Types.Mixed, default: null },

    // Where from.
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The three ways anyone actually reads an audit log: by record, by person, and
// most recent first.
auditLogSchema.index({ resource: 1, recordId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

auditLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('AuditLog', auditLogSchema);
