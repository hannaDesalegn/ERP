/**
 * Purchase orders mock data — C owns this file.
 *
 * Money is integer MINOR UNITS, dates are date-only "YYYY-MM-DD" or ISO
 * timestamps, missing values are null, and every record is obviously invented.
 *
 * Mock data is PER MODULE. The supplier and product details below are
 * duplicated here rather than imported from modules/suppliers or
 * modules/products — duplication is cheaper than coordination, and the values
 * are denormalised onto the order anyway (see the note on denormalisation in
 * docs/entities.md).
 */

/**
 * Supplier id + name, denormalised onto each order at the time it is raised.
 *
 * The real backend reads these from its own tables. The mock keeps a copy so
 * `POST /purchase-orders` can denormalise `supplierName` server-side exactly
 * as the real one will, instead of trusting the client to send it.
 */
const SUPPLIERS = [
  ['sup_0001', 'Abay Industrial Supply'],
  ['sup_0002', 'Zenith Metals PLC'],
  ['sup_0003', 'Kaffa Packaging Works'],
  ['sup_0004', 'Highland Electricals'],
  ['sup_0005', 'Nile Fasteners Ltd'],
  ['sup_0006', 'Rift Chemicals PLC'],
  ['sup_0007', 'Axum Timber Traders'],
  ['sup_0008', 'Selam Safety Equipment'],
  ['sup_0009', 'Dashen Machine Tools'],
  ['sup_0010', 'Bishoftu Plastics'],
  ['sup_0011', 'Wabe Shebelle Cement'],
  ['sup_0012', 'Entoto Cable Company'],
  ['sup_0013', 'Gambella Hardware Import'],
  ['sup_0014', 'Tekeze Logistics Supply'],
  ['sup_0015', 'Borena Aggregates'],
  ['sup_0016', 'Meskel Adhesives PLC'],
  ['sup_0017', 'Lalibela Steelworks'],
  ['sup_0018', 'Awash Lubricants'],
];

/**
 * productId, sku, name, unitPrice — denormalised onto the line when ordered.
 * Covers the whole product catalogue, so any product the picker offers can be
 * denormalised on create rather than falling back to a raw id.
 */
const PRODUCTS = [
  ['prd_0001', 'PRD-0001', 'Galvanised Steel Sheet 2mm', 125000],
  ['prd_0002', 'PRD-0002', 'Copper Wire Coil 50m', 88000],
  ['prd_0003', 'PRD-0003', 'Cardboard Carton Large', 4500],
  ['prd_0004', 'PRD-0004', 'Cardboard Carton Small', 2800],
  ['prd_0005', 'PRD-0005', 'Industrial Adhesive 5L', 62000],
  ['prd_0006', 'PRD-0006', 'Safety Gloves Pair', 3200],
  ['prd_0007', 'PRD-0007', 'LED Panel Light 40W', 47000],
  ['prd_0008', 'PRD-0008', 'Circuit Breaker 32A', 29000],
  ['prd_0009', 'PRD-0009', 'Bolt Assortment Box', 15000],
  ['prd_0010', 'PRD-0010', 'Stainless Hinge 100mm', 8900],
  ['prd_0011', 'PRD-0011', 'Portland Cement 50kg', 11500],
  ['prd_0012', 'PRD-0012', 'Sand Aggregate', 900],
  ['prd_0013', 'PRD-0013', 'Timber Plank 3m', 34000],
  ['prd_0014', 'PRD-0014', 'Shrink Wrap Roll', 12500],
  ['prd_0015', 'PRD-0015', 'Pallet Wooden Standard', 22000],
  ['prd_0016', 'PRD-0016', 'Machine Oil 20L', 78000],
  ['prd_0017', 'PRD-0017', 'Welding Rod 3.2mm', 19500],
  ['prd_0018', 'PRD-0018', 'Angle Grinder Disc', 5600],
  ['prd_0019', 'PRD-0019', 'Extension Cable 10m', 26000],
  ['prd_0020', 'PRD-0020', 'Distribution Board 12way', 145000],
  ['prd_0021', 'PRD-0021', 'Protective Goggles', 4100],
  ['prd_0022', 'PRD-0022', 'Dust Mask Pack of 50', 18000],
  ['prd_0023', 'PRD-0023', 'Steel Pipe 6m 2inch', 96000],
  ['prd_0024', 'PRD-0024', 'Plastic Crate Stackable', 16500],
  ['prd_0025', 'PRD-0025', 'Barcode Label Roll', 7200],
  ['prd_0026', 'PRD-0026', 'Hydraulic Hose 2m', 54000],
  ['prd_0027', 'PRD-0027', 'Voltage Tester', 31000],
  ['prd_0028', 'PRD-0028', 'Finished Panel Assembly A', 210000],
  ['prd_0029', 'PRD-0029', 'Finished Panel Assembly B', 245000],
];

/**
 * Denormalisation lookups. The server owns these — a client that could set
 * productName or supplierName could rewrite history after the fact, which is
 * exactly what the denormalisation note in docs/entities.md warns about.
 */
export function lookupSupplier(supplierId) {
  const found = SUPPLIERS.find(([id]) => id === supplierId);
  return found ? { id: found[0], name: found[1] } : null;
}

export function lookupProduct(productId) {
  const found = PRODUCTS.find(([id]) => id === productId);
  return found
    ? { id: found[0], sku: found[1], name: found[2], unitPrice: found[3] }
    : null;
}

/**
 * Line maths. The server owns these numbers — the UI may preview them but
 * never sends them (docs/entities.md § SalesOrder, docs/security-notes.md §2).
 * Written here so the backend team has an unambiguous reference:
 *
 *   gross     = unitPrice × quantity
 *   discount  = round(gross × discountPercent / 100)
 *   lineTotal = gross − discount            ← net of discount, BEFORE tax
 *   lineTax   = round(lineTotal × taxPercent / 100)
 *   subtotal  = Σ lineTotal
 *   taxTotal  = Σ lineTax
 *   grandTotal = subtotal + taxTotal
 *
 * Every value is an integer in minor units and every division is rounded once,
 * at the line, never at the total. Rounding the total instead loses a cent per
 * line and an ERP that loses cents is worthless.
 *
 * @param {{ unitPrice: number, quantity: number, discountPercent: number }} line
 * @returns {number} integer, minor units
 */
export function calculateLineTotal(line) {
  const gross = line.unitPrice * line.quantity;
  const discount = Math.round((gross * (line.discountPercent ?? 0)) / 100);
  return Math.round(gross - discount);
}

/**
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

/**
 * supplierIndex, orderDate, expectedDate, status, [productIndex, qty, received]
 * `received` is quantityReceived — the one field that makes a PO line differ
 * from a sales order line (docs/entities.md § PurchaseOrder).
 */
const SEED = [
  [0, '2026-02-11', '2026-02-25', 'received', [[0, 100, 100], [5, 400, 400]]],
  [1, '2026-01-24', '2026-02-10', 'received', [[9, 200, 200]]],
  [2, '2026-03-30', '2026-04-15', 'partially_received', [[2, 800, 500], [3, 40, 0]]],
  [3, '2026-04-14', '2026-04-30', 'received', [[4, 120, 120], [8, 10, 10]]],
  [3, '2026-06-27', null, 'draft', [[8, 6, 0]]],
  [4, '2026-05-22', '2026-06-05', 'approved', [[7, 150, 0]]],
  [5, '2026-02-02', '2026-02-20', 'cancelled', [[6, 60, 0]]],
  [6, '2026-07-08', '2026-07-28', 'partially_received', [[9, 40, 15], [0, 80, 80]]],
  [7, '2026-03-17', '2026-04-01', 'received', [[5, 900, 900]]],
  [8, '2026-06-11', '2026-06-30', 'approved', [[5, 1200, 0]]],
  [9, '2026-08-01', '2026-08-20', 'pending_approval', [[0, 200, 0], [9, 60, 0]]],
  [0, '2026-05-03', '2026-05-20', 'approved', [[1, 80, 0], [4, 50, 0]]],
  [0, '2026-07-19', null, 'pending_approval', [[3, 60, 0]]],
  [1, '2026-08-05', '2026-08-25', 'draft', [[9, 30, 0]]],
  [4, '2026-04-02', '2026-04-18', 'received', [[7, 220, 220]]],
  [6, '2026-05-30', '2026-06-14', 'cancelled', [[8, 12, 0]]],
];

/** Deterministic — no randomness, so a refresh shows the same data. */
function makePurchaseOrder(seed, index) {
  const [supplierIndex, orderDate, expectedDate, status, lineSeeds] = seed;
  const number = String(index + 1).padStart(4, '0');
  const [supplierId, supplierName] = SUPPLIERS[supplierIndex];

  const lines = lineSeeds.map(
    ([productIndex, quantity, quantityReceived], lineIndex) => {
      const [productId, sku, productName, unitPrice] = PRODUCTS[productIndex];
      const line = {
        id: `pol_${number}_${lineIndex + 1}`,
        productId,
        productName, // denormalised — the name at the time of the order
        sku, // denormalised
        quantity,
        unitPrice, // integer, minor units
        discountPercent: lineIndex === 0 && index % 4 === 0 ? 5 : 0,
        taxPercent: 15,
        quantityReceived,
        lineTotal: 0, // filled in below, server-calculated
      };
      line.lineTotal = calculateLineTotal(line);
      return line;
    },
  );

  const totals = calculateTotals(lines);

  return {
    id: `po_${number}`,
    poNumber: `PO-2026-${number}`, // human-readable, server-generated
    supplierId,
    supplierName, // denormalised for display
    orderDate, // YYYY-MM-DD — date-only, no timezone confusion
    expectedDate,
    lines,
    ...totals, // subtotal, taxTotal, grandTotal — all server-calculated
    currency: 'ETB',
    status,
    notes: null,
    createdBy: 'usr_0001',
    approvedBy: ['approved', 'partially_received', 'received'].includes(status)
      ? 'usr_0002'
      : null,
    createdAt: `${orderDate}T09:00:00Z`,
    updatedAt: `${orderDate}T09:00:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and mutate this array so create,
 * update, approve and receive behave like a real backend for the length of a
 * page session. A refresh resets it, which is fine for mock data.
 */
export const purchaseOrders = SEED.map(makePurchaseOrder);

/** Next id/number for POST. Kept here so handlers.js stays about HTTP. */
export function nextPurchaseOrderNumber() {
  return String(purchaseOrders.length + 1).padStart(4, '0');
}

/** Next line id within an order. */
export function nextLineId(order, index) {
  return `pol_${order.id.replace('po_', '')}_${index + 1}`;
}
