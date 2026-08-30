// Human-readable document numbers — C owns this file.
//
// SKU-0001, SUP-0001, PO-2026-0001. These are server-generated: entities.md
// marks them read-only in the UI and the create schemas leave them out, so a
// client cannot choose its own.
//
// Known limitation, worth stating plainly rather than hiding: this reads the
// current count and adds one, so two creates landing in the same millisecond
// can produce the same number. The unique index on the field turns that into a
// duplicate-key error rather than two identical SKUs, and at this project's
// scale it will not happen. A production system uses a counters collection with
// findOneAndUpdate($inc) instead. Noted for whoever takes this further.

/**
 * @param {import('mongoose').Model} model
 * @param {string} field the unique field holding the number, e.g. "sku"
 * @param {(n: string) => string} format turns "0001" into "PRD-0001"
 * @returns {Promise<string>}
 */
export async function nextNumber(model, field, format) {
  const total = await model.estimatedDocumentCount();

  // Walk forward if the formatted value is already taken — cheap insurance
  // against a gap left by a deleted record colliding with a new one.
  for (let candidate = total + 1; candidate < total + 100; candidate += 1) {
    const value = format(String(candidate).padStart(4, '0'));
    const exists = await model.exists({ [field]: value });
    if (!exists) return value;
  }

  throw new Error(`Could not allocate a unique ${field}.`);
}
