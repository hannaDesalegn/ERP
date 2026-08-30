// Purchase order money maths — C owns this file.
//
// backend-plan.md §5: totals are calculated server-side and a total sent by a
// client is never trusted. This is the only place they are computed.
//
// Deliberately identical to calculateLineTotal/calculateTotals in
// frontend/src/modules/purchasing/mock.js, including the rounding order. The UI
// shows an optimistic preview while the user types; if the two formulas
// disagree by even one cent the preview and the saved order differ, and the
// user is the one who notices.
//
// Every value is an integer in minor units. Rounding happens at each step
// rather than once at the end, because a fraction of a cent carried between
// lines is what makes two implementations diverge.

/**
 * Gross less discount, rounded to whole minor units.
 * @param {{ unitPrice: number, quantity: number, discountPercent?: number }} line
 * @returns {number} integer, minor units
 */
export function calculateLineTotal(line) {
  const gross = line.unitPrice * line.quantity;
  const discount = Math.round((gross * (line.discountPercent ?? 0)) / 100);
  return Math.round(gross - discount);
}

/**
 * Subtotal, tax and grand total across every line.
 * @param {object[]} lines
 * @returns {{ subtotal: number, taxTotal: number, grandTotal: number }}
 */
export function calculateTotals(lines) {
  let subtotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const lineTotal = calculateLineTotal(line);
    subtotal += lineTotal;
    taxTotal += Math.round((lineTotal * (line.taxPercent ?? 0)) / 100);
  }

  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}
