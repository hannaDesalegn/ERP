/**
 * Settings handlers — owned by A.
 *
 * GET and PATCH /api/settings (docs/api-contract.md §4, A — Foundation).
 * A singleton, not a collection: one resource, so the envelope is `{ data }`
 * with no `meta` and there is no id in the path or the body.
 *
 * There is no Settings typedef in docs/entities.md — this shape is defined by
 * what the app actually reads. Every field here corresponds to something that
 * already exists: `defaultCurrency` and `defaultPaymentTermsDays` seed the
 * Customer fields of those names, `invoiceNumberPrefix` is the "INV" in
 * INV-2026-0117, and `defaultReorderLevel` seeds Product.reorderLevel, which is
 * what drives the low-stock badge. Nothing here is a setting invented for the
 * sake of having one.
 *
 * Fake data only — docs/security-notes.md § Fake data only.
 */

import { http, HttpResponse } from 'msw';

import { delay, serverError, validationError } from './helpers';

const BASE = '/api/settings';

/** What the select offers is the client's business; this is the server's rule. */
const SUPPORTED_CURRENCIES = ['ETB', 'USD', 'EUR'];

/**
 * Mutable on purpose — PATCH writes to it, so edits survive until the page is
 * reloaded, exactly like the other mocks.
 */
let settings = {
  companyName: 'Zion Trading PLC',
  // Address shape from docs/entities.md § Address — same six fields, null for
  // missing, never an empty string.
  companyAddress: {
    line1: '12 Example Street',
    line2: null,
    city: 'Addis Ababa',
    region: 'Addis Ababa',
    country: 'ET', // ISO 3166-1 alpha-2
    postalCode: '1000',
  },
  defaultCurrency: 'ETB', // ISO 4217
  defaultPaymentTermsDays: 30,
  invoiceNumberPrefix: 'INV',
  defaultReorderLevel: 10,
  // Server-managed. The page shows it; a client may never set it.
  updatedAt: '2026-08-12T09:15:00Z',
};

/** Server-managed fields a client must never set or change. */
const READ_ONLY_FIELDS = ['updatedAt'];

/**
 * Mirror of the Zod schema on the page. The server owns the real rules.
 *
 * Nested keys are returned dotted — "companyAddress.city" — because that is
 * exactly what React Hook Form's setError takes for a nested field, so the page
 * maps `fields` onto inputs without translating anything.
 */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if (
    (!partial || has('companyName')) &&
    !String(body.companyName ?? '').trim()
  ) {
    fields.companyName = 'Enter a company name.';
  }

  if (has('companyAddress')) {
    const address = body.companyAddress ?? {};
    if (!String(address.line1 ?? '').trim()) {
      fields['companyAddress.line1'] = 'Enter the first address line.';
    }
    if (!String(address.city ?? '').trim()) {
      fields['companyAddress.city'] = 'Enter a city.';
    }
    if (!/^[A-Z]{2}$/.test(String(address.country ?? ''))) {
      fields['companyAddress.country'] =
        'Use the two-letter country code, e.g. ET.';
    }
  }

  if (
    (!partial || has('defaultCurrency')) &&
    !SUPPORTED_CURRENCIES.includes(body.defaultCurrency)
  ) {
    fields.defaultCurrency = 'Choose a currency.';
  }

  if (
    (!partial || has('defaultPaymentTermsDays')) &&
    (!Number.isInteger(body.defaultPaymentTermsDays) ||
      body.defaultPaymentTermsDays < 0 ||
      body.defaultPaymentTermsDays > 365)
  ) {
    fields.defaultPaymentTermsDays = 'Must be between 0 and 365 days.';
  }

  if (
    (!partial || has('invoiceNumberPrefix')) &&
    !/^[A-Z]{2,5}$/.test(String(body.invoiceNumberPrefix ?? ''))
  ) {
    fields.invoiceNumberPrefix = 'Two to five capital letters, e.g. INV.';
  }

  if (
    (!partial || has('defaultReorderLevel')) &&
    (!Number.isInteger(body.defaultReorderLevel) ||
      body.defaultReorderLevel < 0)
  ) {
    fields.defaultReorderLevel = 'Must be zero or greater.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export const settingsHandlers = [
  /** Always 500. Point the page at this to see its error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load settings. Try again.');
  }),

  /** GET /api/settings — single resource, so { data } and no meta. */
  http.get(BASE, async () => {
    await delay();
    return HttpResponse.json({ data: settings });
  }),

  /** PATCH /api/settings — partial, 200 with the updated resource. */
  http.patch(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    // companyAddress is replaced wholesale rather than deep-merged: the form
    // always sends all six fields, and a half-merged address is worse than an
    // obviously replaced one. A real backend should take the same position and
    // say so in its own docs.
    settings = {
      ...settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: settings });
  }),
];
