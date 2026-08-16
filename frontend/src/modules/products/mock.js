/**
 * Products mock data — C owns this file.
 *
 * Copied from modules/customers/mock.js and swapped to the Product entity.
 * Money is integer MINOR UNITS, dates are ISO strings, missing values are null,
 * and every record is obviously invented — docs/security-notes.md § Fake data.
 *
 * Mock data is PER MODULE. Nothing here is imported by another module, and this
 * file imports nothing from theirs.
 */

/** @typedef {import('./schema').ProductInput} ProductInput */

/**
 * Categories. docs/entities.md defines `categoryId` + denormalised
 * `categoryName` on Product but never defines the Category shape itself, even
 * though GET /api/products/categories exists in the API contract. Using the
 * minimum the UI needs; raised with the group.
 */
export const categories = [
  { id: 'cat_01', name: 'Raw materials' },
  { id: 'cat_02', name: 'Packaging' },
  { id: 'cat_03', name: 'Hardware' },
  { id: 'cat_04', name: 'Electrical' },
  { id: 'cat_05', name: 'Consumables' },
  { id: 'cat_06', name: 'Finished goods' },
];

/**
 * name, categoryIndex, unitOfMeasure, costPrice, sellingPrice, quantityOnHand,
 * quantityReserved, reorderLevel, status
 *
 * Money values are integers in MINOR UNITS: 125000 = 1,250.00 ETB.
 * Quantities are plain numbers and may carry decimals (2.5 kg) — they are not
 * money, so a float is fine there and only there.
 */
const SEED = [
  ['Galvanised Steel Sheet 2mm', 0, 'pcs', 125000, 189000, 240, 40, 50, 'active'],
  ['Copper Wire Coil 50m', 3, 'pcs', 88000, 134000, 96, 12, 25, 'active'],
  ['Cardboard Carton Large', 1, 'box', 4500, 7900, 1200, 150, 300, 'active'],
  ['Cardboard Carton Small', 1, 'box', 2800, 5200, 18, 0, 200, 'active'],
  ['Industrial Adhesive 5L', 4, 'ltr', 62000, 95000, 74, 8, 20, 'active'],
  ['Safety Gloves Pair', 4, 'pcs', 3200, 6500, 480, 60, 100, 'active'],
  ['LED Panel Light 40W', 3, 'pcs', 47000, 78000, 0, 0, 30, 'active'],
  ['Circuit Breaker 32A', 3, 'pcs', 29000, 51000, 156, 24, 40, 'active'],
  ['Bolt Assortment Box', 2, 'box', 15000, 27500, 62, 5, 25, 'active'],
  ['Stainless Hinge 100mm', 2, 'pcs', 8900, 16400, 340, 0, 80, 'active'],
  ['Portland Cement 50kg', 0, 'kg', 11500, 18900, 850, 200, 250, 'active'],
  ['Sand Aggregate', 0, 'kg', 900, 2100, 12000, 3000, 2000, 'active'],
  ['Timber Plank 3m', 0, 'pcs', 34000, 56000, 118, 20, 40, 'active'],
  ['Shrink Wrap Roll', 1, 'pcs', 12500, 21000, 210, 30, 60, 'active'],
  ['Pallet Wooden Standard', 1, 'pcs', 22000, 38000, 45, 10, 50, 'active'],
  ['Machine Oil 20L', 4, 'ltr', 78000, 118000, 33, 4, 15, 'active'],
  ['Welding Rod 3.2mm', 2, 'kg', 19500, 32000, 275, 45, 80, 'active'],
  ['Angle Grinder Disc', 2, 'pcs', 5600, 11200, 620, 90, 150, 'active'],
  ['Extension Cable 10m', 3, 'pcs', 26000, 44500, 88, 12, 30, 'active'],
  ['Distribution Board 12way', 3, 'pcs', 145000, 219000, 14, 2, 10, 'active'],
  ['Protective Goggles', 4, 'pcs', 4100, 8900, 390, 40, 100, 'active'],
  ['Dust Mask Pack of 50', 4, 'box', 18000, 31000, 27, 0, 40, 'active'],
  ['Steel Pipe 6m 2inch', 0, 'pcs', 96000, 148000, 64, 14, 30, 'active'],
  ['Plastic Crate Stackable', 1, 'pcs', 16500, 28900, 305, 55, 80, 'active'],
  ['Barcode Label Roll', 1, 'pcs', 7200, 13500, 140, 0, 50, 'active'],
  ['Hydraulic Hose 2m', 2, 'pcs', 54000, 87000, 41, 6, 20, 'active'],
  ['Voltage Tester', 3, 'pcs', 31000, 52000, 76, 8, 25, 'active'],
  ['Finished Panel Assembly A', 5, 'pcs', 210000, 335000, 22, 8, 10, 'active'],
  ['Finished Panel Assembly B', 5, 'pcs', 245000, 389000, 9, 4, 10, 'active'],
  ['Legacy Ballast Unit', 3, 'pcs', 22000, 0, 6, 0, 0, 'discontinued'],
  ['Legacy Fuse Box 6way', 3, 'pcs', 41000, 0, 3, 0, 0, 'discontinued'],
  ['Obsolete Packing Tape', 1, 'pcs', 3900, 0, 0, 0, 0, 'discontinued'],
];

/** Deterministic — no randomness, so a refresh shows the same data. */
function makeProduct(seed, index) {
  const [
    name,
    categoryIndex,
    unitOfMeasure,
    costPrice,
    sellingPrice,
    quantityOnHand,
    quantityReserved,
    reorderLevel,
    status,
  ] = seed;

  const number = String(index + 1).padStart(4, '0');
  const category = categories[categoryIndex];

  return {
    id: `prd_${number}`,
    sku: `PRD-${number}`, // human-readable, server-generated
    name,
    description: null,
    categoryId: category.id,
    categoryName: category.name, // denormalised for display
    unitOfMeasure,
    costPrice, // integer, minor units
    sellingPrice, // integer, minor units
    currency: 'ETB', // ISO 4217, stored per-document
    quantityOnHand,
    quantityReserved, // committed to approved orders
    quantityAvailable: quantityOnHand - quantityReserved, // server-calculated
    reorderLevel,
    barcode: `50100000${number}`,
    imageUrl: null,
    status,
    // Spread across 2026 so date filters and sorting have something to bite on.
    createdAt: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}T08:15:00Z`,
    updatedAt: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T11:40:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and splice this array so create,
 * update and delete behave like a real backend for the length of a page
 * session. A refresh resets it, which is fine for mock data.
 */
export const products = SEED.map(makeProduct);

/**
 * Stock movement history. Seeded so the detail page has something to show
 * before anyone adjusts anything.
 */
const ADJUSTMENT_SEED = [
  ['prd_0001', 'increase', 100, 'purchase', 'PO-2026-0012'],
  ['prd_0001', 'decrease', 35, 'sale', 'SO-2026-0031'],
  ['prd_0004', 'decrease', 180, 'sale', 'SO-2026-0044'],
  ['prd_0004', 'decrease', 2, 'damage', null],
  ['prd_0007', 'decrease', 30, 'sale', 'SO-2026-0050'],
  ['prd_0007', 'decrease', 4, 'loss', null],
  ['prd_0012', 'increase', 5000, 'purchase', 'PO-2026-0018'],
  ['prd_0022', 'decrease', 13, 'count_correction', null],
  ['prd_0022', 'increase', 40, 'return', 'SO-2026-0027'],
];

export const adjustments = ADJUSTMENT_SEED.map(
  ([productId, direction, quantity, reason, reference], index) => ({
    id: `adj_${String(index + 1).padStart(4, '0')}`,
    productId,
    productName:
      products.find((product) => product.id === productId)?.name ?? 'Unknown',
    direction,
    quantity,
    reason,
    reference,
    notes: null,
    createdBy: 'usr_0001',
    createdAt: `2026-0${(index % 8) + 1}-1${index % 9}T10:00:00Z`,
  }),
);

/** Next id/sku for POST. Kept here so handlers.js stays about HTTP. */
export function nextProductNumber() {
  return String(products.length + 1).padStart(4, '0');
}

/** Next adjustment id for POST. */
export function nextAdjustmentNumber() {
  return String(adjustments.length + 1).padStart(4, '0');
}
