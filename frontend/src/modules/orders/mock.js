/**
 * Orders mock data — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the seed array, the code prefix, and the fields in `makeOrder` to
 *         match your entity in docs/entities.md.
 * KEEP:   money as integers in minor units, dates as ISO strings, `null` for
 *         missing values, and data that is obviously fake.
 * Mock data is PER MODULE. If you need a customer record in your module, copy
 * one — never import from here. Duplication is cheaper than coordination.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every record here is invented. No real company, no real phone number, no real
 * email. Fake data in a public repo is a non-event; real data is an incident.
 * See docs/security-notes.md § Fake data only.
 */

/** @typedef {import('./schema').SalesOrderInput} SalesOrderInput */

// Denormalised references — a real SalesOrder copies these onto itself
// (customerName, productName, sku, unitPrice) rather than looking them up
// live. See docs/entities.md "On denormalisation".
const FAKE_CUSTOMERS = [
  ['cus_0001', 'Acme Trading PLC'],
  ['cus_0002', 'Blue Nile Supplies'],
  ['cus_0004', 'Rift Valley Logistics'],
  ['cus_0026', 'Abebe Kebede'],
  ['cus_0029', 'Selamawit Girma'],
];

const FAKE_PRODUCTS = [
  ['prd_0001', 'Steel Roofing Sheet 2mm', 'STL-RF-2MM', 85000],
  ['prd_0002', 'Cement 50kg Bag', 'CEM-50KG', 62000],
  ['prd_0003', 'Ceramic Floor Tile (box)', 'TIL-FLR-01', 145000],
  ['prd_0004', 'PVC Pipe 4-inch (6m)', 'PVC-4IN-6M', 39000],
  ['prd_0005', 'LED Panel Light 40W', 'LED-40W', 21000],
];

const STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'fulfilled',
  'cancelled',
];

/**
 * quantity, discountPercent, taxPercent per line.
 * unitPrice is looked up from FAKE_PRODUCTS at build time, never invented here
 * — this mirrors how a real order copies the product's price at that moment.
 */
const SEED = [
  // [customerIndex, statusIndex, daysAgo, hasExpectedDelivery, lines]
  [0, 2, 12, true, [[0, 20, 0, 15], [1, 100, 5, 15]]],
  [1, 3, 30, true, [[3, 50, 0, 15]]],
  [2, 0, 1, false, [[2, 8, 0, 15]]],
  [3, 1, 5, true, [[4, 15, 10, 15]]],
  [4, 3, 45, true, [[0, 10, 0, 15], [4, 6, 0, 15]]],
  [0, 4, 20, false, [[1, 40, 0, 15]]],
  [1, 2, 8, true, [[2, 12, 5, 15]]],
  [2, 3, 60, true, [[3, 25, 0, 15], [1, 30, 0, 15]]],
  [3, 0, 2, false, [[0, 5, 0, 15]]],
  [4, 2, 15, true, [[4, 20, 0, 15]]],
];

/** quantity * unitPrice, minus discount, plus tax — integer, minor units. */
function computeLineTotal(unitPrice, quantity, discountPercent, taxPercent) {
  const gross = unitPrice * quantity;
  const afterDiscount = gross - Math.round((gross * discountPercent) / 100);
  const withTax = afterDiscount + Math.round((afterDiscount * taxPercent) / 100);
  return Math.round(withTax);
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, per entities.md
}

/** Deterministic fake data — no randomness, so tests and snapshots are stable. */
function makeOrder(seed, index) {
  const [customerIndex, statusIndex, daysAgo, hasExpected, lineSeeds] = seed;
  const [customerId, customerName] = FAKE_CUSTOMERS[customerIndex];
  const number = String(index + 1).padStart(4, '0');

  const lines = lineSeeds.map(([productIndex, quantity, discountPercent, taxPercent], lineIndex) => {
    const [productId, productName, sku, unitPrice] = FAKE_PRODUCTS[productIndex];
    return {
      id: `sol_${number}_${lineIndex + 1}`,
      productId,
      productName, // denormalised — frozen at order time
      sku, // denormalised
      quantity,
      unitPrice, // denormalised — frozen at order time
      discountPercent,
      taxPercent,
      lineTotal: computeLineTotal(unitPrice, quantity, discountPercent, taxPercent),
    };
  });

  // These four are normally the SERVER's job — the mock recreates that
  // calculation once, here, so the seed data is internally consistent.
  // A real create/update handler must recompute these, never trust the body.
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discountTotal = lines.reduce(
    (sum, l) => sum + Math.round((l.unitPrice * l.quantity * l.discountPercent) / 100),
    0,
  );
  const taxTotal = lines.reduce((sum, l) => {
    const afterDiscount =
      l.unitPrice * l.quantity - Math.round((l.unitPrice * l.quantity * l.discountPercent) / 100);
    return sum + Math.round((afterDiscount * l.taxPercent) / 100);
  }, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  return {
    id: `so_${number}`,
    orderNumber: `SO-2026-${number}`, // human-readable, server-generated
    customerId,
    customerName, // denormalised
    orderDate: isoDate(daysAgo),
    expectedDeliveryDate: hasExpected ? isoDate(daysAgo - 10) : null,
    lines,
    subtotal, // integer, minor units
    discountTotal,
    taxTotal,
    grandTotal,
    currency: 'ETB',
    status: STATUSES[statusIndex],
    notes: null,
    createdBy: 'usr_0001', // fake userId — Users/roles are A's module
    approvedBy: statusIndex >= 2 ? 'usr_0001' : null, // set once approved+
    createdAt: `${isoDate(daysAgo)}T09:30:00Z`,
    updatedAt: `${isoDate(Math.max(daysAgo - 1, 0))}T14:05:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and splice this array so create,
 * update and delete behave like a real backend for the length of a page
 * session. A page refresh resets it, which is fine for mock data.
 */
export const orders = SEED.map(makeOrder);

/** Next id/code for POST. Kept here so handlers.js stays about HTTP. */
export function nextOrderNumber() {
  return String(orders.length + 1).padStart(4, '0');
}