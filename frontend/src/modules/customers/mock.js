/**
 * Customers mock data — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the seed array, the code prefix, and the fields in `makeCustomer` to
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

/** @typedef {import('./schema').CustomerInput} CustomerInput */

const CITIES = [
  ['Addis Ababa', 'Addis Ababa'],
  ['Adama', 'Oromia'],
  ['Bahir Dar', 'Amhara'],
  ['Hawassa', 'Sidama'],
  ['Mekelle', 'Tigray'],
  ['Dire Dawa', 'Dire Dawa'],
];

/**
 * name, type, status, creditLimit, balance, paymentTermsDays
 * Money values are integers in MINOR UNITS: 14990000 = 149,900.00 ETB.
 */
const SEED = [
  ['Acme Trading PLC', 'company', 'active', 50000000, 14990000, 30],
  ['Blue Nile Supplies', 'company', 'active', 20000000, 0, 15],
  ['Habesha Distributors', 'company', 'blocked', 10000000, 24500000, 30],
  ['Rift Valley Logistics', 'company', 'active', 30000000, 8750000, 45],
  ['Awash Metalworks', 'company', 'active', 15000000, 3120000, 30],
  ['Sheba Textiles', 'company', 'inactive', 5000000, 450000, 15],
  ['Omo Valley Foods', 'company', 'active', 60000000, 18750000, 60],
  ['Danakil Minerals', 'company', 'blocked', 0, 0, 30],
  ['Simien Hardware', 'company', 'active', 12000000, 963000, 30],
  ['Bale Mountain Traders', 'company', 'active', 40000000, 5284000, 45],
  ['Gondar Packaging', 'company', 'inactive', 8000000, 72000, 15],
  ['Tana Freight Services', 'company', 'active', 35000000, 10430000, 30],
  ['Harar Coffee Exporters', 'company', 'active', 75000000, 22100000, 60],
  ['Jimma Agro Supplies', 'company', 'active', 18000000, 1450000, 30],
  ['Afar Salt Works', 'company', 'inactive', 6000000, 0, 15],
  ['Wolaita Construction PLC', 'company', 'active', 90000000, 41200000, 90],
  ['Arba Minch Fisheries', 'company', 'active', 9000000, 780000, 30],
  ['Debre Markos Millers', 'company', 'blocked', 4000000, 3900000, 30],
  ['Nekemte Timber Co', 'company', 'active', 22000000, 6540000, 45],
  ['Sodo Electrical Supply', 'company', 'active', 14000000, 2210000, 30],
  ['Ambo Bottling PLC', 'company', 'active', 28000000, 9130000, 30],
  ['Dessie Auto Parts', 'company', 'inactive', 7000000, 156000, 15],
  ['Shashamane Grain Traders', 'company', 'active', 33000000, 12400000, 45],
  ['Assosa Mining Supplies', 'company', 'active', 11000000, 890000, 30],
  ['Kombolcha Steel PLC', 'company', 'active', 55000000, 19870000, 60],
  ['Abebe Kebede', 'individual', 'active', 500000, 125000, 15],
  ['Tigist Haile', 'individual', 'active', 300000, 0, 15],
  ['Mulugeta Assefa', 'individual', 'inactive', 200000, 45000, 15],
  ['Selamawit Girma', 'individual', 'active', 800000, 312000, 30],
  ['Yohannes Tadesse', 'individual', 'blocked', 100000, 98000, 15],
];

/** Deterministic fake data — no randomness, so tests and snapshots are stable. */
function makeCustomer(seed, index) {
  const [name, type, status, creditLimit, balance, paymentTermsDays] = seed;
  const number = String(index + 1).padStart(4, '0');
  const [city, region] = CITIES[index % CITIES.length];
  const isCompany = type === 'company';

  return {
    id: `cus_${number}`,
    code: `CUS-${number}`, // human-readable, server-generated
    name,
    type,
    tin: isCompany ? `000${number}${number}` : null,
    email: `customer${number}@example-erp.test`,
    phone: `+251-900-000-${number.slice(-3)}`,
    contactPerson: isCompany ? 'Contact Person' : null,
    billingAddress: {
      line1: `${index + 1} Example Street`,
      line2: null,
      city,
      region,
      country: 'ET', // ISO 3166-1 alpha-2
      postalCode: `1${number}`,
    },
    // null means "same as billing" — not an empty object.
    shippingAddress: null,
    creditLimit, // integer, minor units
    balance, // integer, minor units — server-calculated
    paymentTermsDays,
    currency: 'ETB', // ISO 4217, stored per-document
    status,
    notes: null,
    // Spread across 2026 so date filters and sorting have something to bite on.
    createdAt: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}T09:30:00Z`,
    updatedAt: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T14:05:00Z`,
  };
}

/**
 * Mutable on purpose: the handlers push, patch and splice this array so create,
 * update and delete behave like a real backend for the length of a page
 * session. A page refresh resets it, which is fine for mock data.
 */
export const customers = SEED.map(makeCustomer);

/** Next id/code for POST. Kept here so handlers.js stays about HTTP. */
export function nextCustomerNumber() {
  return String(customers.length + 1).padStart(4, '0');
}
