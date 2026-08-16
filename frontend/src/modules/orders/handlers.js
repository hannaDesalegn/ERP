/**
 * Orders MSW handlers — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the path, the mock array, the validation rules, the searchFields.
 * KEEP:   the helpers (paginate/delay/validationError/notFound/serverError),
 *         the status codes, and the deliberate-failure endpoints.
 * ROUTE ORDER MATTERS: MSW matches top to bottom, so any literal path that
 * could be mistaken for an :id — like /orders/demo-server-error — must be
 * declared BEFORE the /orders/:id handler or it will never be reached.
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

import { orders, nextOrderNumber } from './mock';

const BASE = '/api/orders';

/** Server-managed fields a client must never be able to set or change. */
const READ_ONLY_FIELDS = [
  'id',
  'orderNumber',
  'subtotal',
  'discountTotal',
  'taxTotal',
  'grandTotal',
  'approvedBy',
  'createdAt',
  'updatedAt',
];

/** Mirror of schema.js. The server owns the real rules; this imitates them. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if ((!partial || has('customerId')) && !String(body.customerId ?? '').trim()) {
    fields.customerId = 'Choose a customer.';
  }
  if ((!partial || has('orderDate')) && !String(body.orderDate ?? '').trim()) {
    fields.orderDate = 'Pick an order date.';
  }
  if ((!partial || has('lines')) && !Array.isArray(body.lines)) {
    fields.lines = 'Add at least one line item.';
  } else if (has('lines') && body.lines.length === 0) {
    fields.lines = 'Add at least one line item.';
  }
  if (
    has('status') &&
    !['draft', 'pending_approval', 'approved', 'fulfilled', 'cancelled'].includes(
      body.status,
    )
  ) {
    fields.status = 'Choose a valid status.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export const orderHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────
  // Declared first so the :id routes below don't swallow them.

  /** Always 500. Wire a button to this to see the list's error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load orders. Try again.');
  }),

  /** Always 422, with two field errors RHF can map onto inputs. */
  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      customerId: 'Choose a customer.',
      lines: 'Add at least one line item.',
    });
  }),

  // ── The five verbs ─────────────────────────────────────────────────────────

  /** GET /api/orders — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(orders, url, {
        searchFields: ['orderNumber', 'customerName'],
        filterKeys: ['status', 'customerId'],
      }),
    );
  }),

  /** GET /api/orders/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = orders.find((order) => order.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound('Order');
  }),

  /** POST /api/orders — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const number = nextOrderNumber();
    const now = new Date().toISOString();

    const created = {
      ...body,
      // Server-generated, so they overwrite anything the client sent.
      id: `so_${number}`,
      orderNumber: `SO-2026-${number}`,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    orders.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/orders/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = orders.findIndex((order) => order.id === params.id);
    if (index === -1) return notFound('Order');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    // Drop server-managed fields rather than trusting the body.
    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    orders[index] = {
      ...orders[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: orders[index] });
  }),

  /** DELETE /api/orders/:id — archive. 204, no body. */
  http.delete(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const index = orders.findIndex((order) => order.id === params.id);
    if (index === -1) return notFound('Order');

    orders.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];