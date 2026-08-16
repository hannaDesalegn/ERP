/**
 * Suppliers mock data — C owns this file.
 *
 * Money is integer MINOR UNITS, dates are ISO strings, missing values are null,
 * and every record is obviously invented — docs/security-notes.md § Fake data.
 *
 * Mock data is PER MODULE. The purchase-order summaries at the bottom are
 * duplicated here rather than imported from modules/purchasing, exactly as the
 * README prescribes: duplication is cheaper than coordination, and it keeps the
 * two modules independently deletable.
 */

/** @typedef {import('./schema').SupplierInput} SupplierInput */

const CITIES = [
  ['Addis Ababa', 'Addis Ababa'],
  ['Adama', 'Oromia'],
  ['Bahir Dar', 'Amhara'],
  ['Hawassa', 'Sidama'],
  ['Mekelle', 'Tigray'],
  ['Dire Dawa', 'Dire Dawa'],
];

/**
 * name, status, balance, paymentTermsDays
 * `balance` is what WE owe THEM — integer, minor units, server-calculated.
 */
const SEED = [
  ['Abay Industrial Supply', 'active', 18450000, 30],
  ['Zenith Metals PLC', 'active', 0, 45],
  ['Kaffa Packaging Works', 'active', 6720000, 15],
  ['Highland Electricals', 'active', 23100000, 30],
  ['Nile Fasteners Ltd', 'active', 1890000, 30],
  ['Rift Chemicals PLC', 'inactive', 0, 60],
  ['Axum Timber Traders', 'active', 9340000, 45],
  ['Selam Safety Equipment', 'active', 2760000, 15],
  ['Dashen Machine Tools', 'active', 41200000, 60],
  ['Bishoftu Plastics', 'active', 5130000, 30],
  ['Wabe Shebelle Cement', 'active', 12800000, 30],
  ['Entoto Cable Company', 'inactive', 430000, 15],
  ['Gambella Hardware Import', 'active', 7650000, 45],
  ['Tekeze Logistics Supply', 'active', 3210000, 30],
  ['Borena Aggregates', 'active', 15900000, 30],
  ['Meskel Adhesives PLC', 'active', 890000, 15],
  ['Lalibela Steelworks', 'active', 28400000, 60],
  ['Awash Lubricants', 'inactive', 0, 30],
];

/** Deterministic — no randomness, so a refresh shows the same data. */
function makeSupplier(seed, index) {
  const [name, status, balance, paymentTermsDays] = seed;
  const number = String(index + 1).padStart(4, '0');
  const [city, region] = CITIES[index % CITIES.length];

  return {
    id: `sup_${number}`,
    code: `SUP-${number}`, // human-readable, server-generated
    name,
    tin: `000${number}${number}`,
    email: `supplier${number}@example-erp.test`,
    phone: `+251-911-000-${number.slice(-3)}`,
    contactPerson: 'Contact Person',
    address: {
      line1: `${index + 1} Example Avenue`,
      line2: null,
      city,
      region,
      country: 'ET', // ISO 3166-1 alpha-2
      postalCode: `1${number}`,
    },
    paymentTermsDays,
    currency: 'ETB', // ISO 4217, stored per-document
    balance, // integer, minor units — server-calculated
    status,
    notes: null,
    // Spread across 2026 so date filters and sorting have something to bite on.
    createdAt: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}T07:45:00Z`,
    updatedAt: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T13:20:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and splice this array so create,
 * update and delete behave like a real backend for the length of a page
 * session. A refresh resets it, which is fine for mock data.
 */
export const suppliers = SEED.map(makeSupplier);

/**
 * Purchase-order summaries for the supplier detail page.
 *
 * Deliberately a SUMMARY shape, not the full PurchaseOrder entity: this
 * endpoint feeds one read-only table and nothing else. modules/purchasing owns
 * the real records.
 *
 * supplierId, poNumber, orderDate, status, grandTotal
 */
const PO_SEED = [
  ['sup_0001', 'PO-2026-0012', '2026-02-11', 'received', 18450000],
  ['sup_0001', 'PO-2026-0029', '2026-05-03', 'approved', 9200000],
  ['sup_0001', 'PO-2026-0044', '2026-07-19', 'pending_approval', 4300000],
  ['sup_0002', 'PO-2026-0007', '2026-01-24', 'received', 31000000],
  ['sup_0003', 'PO-2026-0018', '2026-03-30', 'partially_received', 6720000],
  ['sup_0004', 'PO-2026-0021', '2026-04-14', 'received', 23100000],
  ['sup_0004', 'PO-2026-0038', '2026-06-27', 'draft', 5400000],
  ['sup_0005', 'PO-2026-0031', '2026-05-22', 'approved', 1890000],
  ['sup_0007', 'PO-2026-0009', '2026-02-02', 'cancelled', 2100000],
  ['sup_0009', 'PO-2026-0041', '2026-07-08', 'partially_received', 41200000],
  ['sup_0011', 'PO-2026-0016', '2026-03-17', 'received', 12800000],
  ['sup_0015', 'PO-2026-0035', '2026-06-11', 'approved', 15900000],
  ['sup_0017', 'PO-2026-0046', '2026-08-01', 'pending_approval', 28400000],
];

export const supplierPurchaseOrders = PO_SEED.map(
  ([supplierId, poNumber, orderDate, status, grandTotal], index) => ({
    id: `po_${String(index + 1).padStart(4, '0')}`,
    supplierId,
    poNumber,
    orderDate, // YYYY-MM-DD — date-only, no timezone confusion
    status,
    grandTotal, // integer, minor units
    currency: 'ETB',
    createdAt: `${orderDate}T09:00:00Z`,
  }),
);

/** Next id/code for POST. Kept here so handlers.js stays about HTTP. */
export function nextSupplierNumber() {
  return String(suppliers.length + 1).padStart(4, '0');
}
