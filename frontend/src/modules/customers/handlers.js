/**
 * Customers MSW handlers — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the path, the mock array, the validation rules, the searchFields.
 * KEEP:   the helpers (paginate/delay/validationError/notFound/serverError),
 *         the status codes, and the deliberate-failure endpoints.
 * ROUTE ORDER MATTERS: MSW matches top to bottom, so any literal path that
 * could be mistaken for an :id — like /customers/demo-server-error — must be
 * declared BEFORE the /customers/:id handler or it will never be reached.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mock the failures, not just the happy path. A happy-path-only mock produces a
 * UI that falls apart the first time the real backend returns a 422.
 */

import { http, HttpResponse } from 'msw';

import {
  delay,
  notFound,
  paginate,
  serverError,
  validationError,
} from '@/mocks/helpers';

import { customers, nextCustomerNumber } from './mock';

const BASE = '/api/customers';

/** Server-managed fields a client must never be able to set or change. */
const READ_ONLY_FIELDS = ['id', 'code', 'balance', 'createdAt', 'updatedAt'];

/** Mirror of schema.js. The server owns the real rules; this imitates them. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if ((!partial || has('name')) && !String(body.name ?? '').trim()) {
    fields.name = 'Enter a customer name.';
  }
  if (
    has('email') &&
    body.email !== null &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)
  ) {
    fields.email = 'Must be a valid email address.';
  }
  if (
    has('creditLimit') &&
    (!Number.isInteger(body.creditLimit) || body.creditLimit < 0)
  ) {
    fields.creditLimit = 'Must be zero or greater.';
  }
  if (has('type') && !['company', 'individual'].includes(body.type)) {
    fields.type = 'Choose a customer type.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export const customerHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────
  // Declared first so the :id routes below don't swallow them.

  /** Always 500. Wire a button to this to see the list's error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load customers. Try again.');
  }),

  /** Always 422, with two field errors RHF can map onto inputs. */
  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      email: 'Must be a valid email address.',
      creditLimit: 'Must be zero or greater.',
    });
  }),

  // ── The five verbs ─────────────────────────────────────────────────────────

  /** GET /api/customers — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(customers, url, {
        searchFields: ['code', 'name', 'email', 'phone', 'contactPerson'],
        filterKeys: ['status', 'type'],
      }),
    );
  }),

  /** GET /api/customers/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = customers.find((customer) => customer.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound('Customer');
  }),

  /** POST /api/customers — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const number = nextCustomerNumber();
    const now = new Date().toISOString();

    const created = {
      ...body,
      // Server-generated, so they overwrite anything the client sent.
      id: `cus_${number}`,
      code: `CUS-${number}`,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    };

    customers.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/customers/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = customers.findIndex((customer) => customer.id === params.id);
    if (index === -1) return notFound('Customer');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    // Drop server-managed fields rather than trusting the body.
    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    customers[index] = {
      ...customers[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: customers[index] });
  }),

  /** DELETE /api/customers/:id — archive. 204, no body. */
  http.delete(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const index = customers.findIndex((customer) => customer.id === params.id);
    if (index === -1) return notFound('Customer');

    customers.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
