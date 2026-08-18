/**
 * Invoices mock data — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the seed array, the code prefix, and the fields in `makeInvoice` to
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

/** @typedef {import('./schema').InvoiceInput} InvoiceInput */

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

// 'overdue' is deliberately absent — it's server-derived from dueDate and
// amountDue, never picked as a starting status. See entities.md line 218.
const STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'void'];

/**
 * customerIndex, statusIndex, daysAgoIssued, dueInDays, amountPaidFraction
 * (0 = nothing paid, 1 = fully paid, 0.5 = half paid), lines, hasSalesOrder
 */
const SEED = [
  [0, 3, 40, 30, 1, [[0, 20, 15]], true],
  [1, 1, 5, 30, 0, [[3, 50, 15]], true],
  [2, 2, 20, 15, 0.5, [[2, 8, 15]], false],
  [3, 0, 1, 30, 0, [[4, 15, 15]], false],
  [4, 3, 60, 30, 1, [[0, 10, 15], [4, 6, 15]], true],
  [0, 4, 90, 30, 0, [[1, 40, 15]], false],
  [1, 1, 10, 15, 0, [[2, 12, 15]], true],
  [2, 3, 75, 30, 1, [[3, 25, 15], [1, 30, 15]], true],
  [3, 2, 25, 15, 0.5, [[0, 5, 15]], false],
  [4, 1, 3, 30, 0, [[4, 20, 15]], true],
];

/** quantity * unitPrice, plus tax — integer, minor units. No discount stage. */
function computeLineTotal(unitPrice, quantity, taxPercent) {
  const gross = unitPrice * quantity;
  return Math.round(gross + (gross * taxPercent) / 100);
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Deterministic fake data — no randomness, so tests and snapshots are stable. */
function makeInvoice(seed, index) {
  const [
    customerIndex,
    statusIndex,
    daysAgoIssued,
    dueInDays,
    paidFraction,
    lineSeeds,
    hasSalesOrder,
  ] = seed;
  const [customerId, customerName] = FAKE_CUSTOMERS[customerIndex];
  const number = String(index + 1).padStart(4, '0');
  const issueDate = isoDate(daysAgoIssued);

  const lines = lineSeeds.map(([productIndex, quantity, taxPercent], lineIndex) => {
    const [productId, productName, sku, unitPrice] = FAKE_PRODUCTS[productIndex];
    return {
      id: `inl_${number}_${lineIndex + 1}`,
      productId,
      productName, // denormalised — frozen at invoice time
      sku,
      quantity,
      unitPrice, // denormalised — frozen at invoice time
      taxPercent,
      lineTotal: computeLineTotal(unitPrice, quantity, taxPercent),
    };
  });

  // Server-owned math, recreated here once so the seed data is consistent.
  // A real create/update handler must recompute these, never trust the body.
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxTotal = lines.reduce(
    (sum, l) => sum + Math.round((l.unitPrice * l.quantity * l.taxPercent) / 100),
    0,
  );
  const grandTotal = subtotal + taxTotal;
  const amountPaid = Math.round(grandTotal * paidFraction);
  const amountDue = grandTotal - amountPaid; // always derived, never stored independently

  return {
    id: `inv_${number}`,
    invoiceNumber: `INV-2026-${number}`, // human-readable, server-generated
    salesOrderId: hasSalesOrder ? `so_${number}` : null,
    customerId,
    customerName, // denormalised
    issueDate,
    dueDate: addDays(issueDate, dueInDays),
    lines,
    subtotal, // integer, minor units
    taxTotal,
    grandTotal,
    amountPaid,
    amountDue, // grandTotal - amountPaid — never edited directly
    currency: 'ETB',
    status: STATUSES[statusIndex],
    notes: null,
    createdAt: `${issueDate}T09:30:00Z`,
    updatedAt: `${isoDate(Math.max(daysAgoIssued - 1, 0))}T14:05:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and splice this array so create,
 * update and delete behave like a real backend for the length of a page
 * session. A page refresh resets it, which is fine for mock data.
 */
export const invoices = SEED.map(makeInvoice);

/** Next id/code for POST. Kept here so handlers.js stays about HTTP. */
export function nextInvoiceNumber() {
  return String(invoices.length + 1).padStart(4, '0');
}