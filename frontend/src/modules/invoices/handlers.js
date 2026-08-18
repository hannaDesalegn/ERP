/**
 * Invoices MSW handlers — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the path, the mock array, the validation rules, the searchFields.
 * KEEP:   the helpers (paginate/delay/validationError/notFound/serverError),
 *         the status codes, and the deliberate-failure endpoints.
 * ROUTE ORDER MATTERS: MSW matches top to bottom, so any literal path that
 * could be mistaken for an :id — like /invoices/demo-server-error — must be
 * declared BEFORE the /invoices/:id handler or it will never be reached.
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

import { invoices, nextInvoiceNumber } from './mock';

const BASE = '/api/invoices';

/** Server-managed fields a client must never be able to set or change. */
const READ_ONLY_FIELDS = [
  'id',
  'invoiceNumber',
  'subtotal',
  'taxTotal',
  'grandTotal',
  'amountDue',
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
  if ((!partial || has('issueDate')) && !String(body.issueDate ?? '').trim()) {
    fields.issueDate = 'Pick an issue date.';
  }
  if ((!partial || has('dueDate')) && !String(body.dueDate ?? '').trim()) {
    fields.dueDate = 'Pick a due date.';
  }
  if ((!partial || has('lines')) && !Array.isArray(body.lines)) {
    fields.lines = 'Add at least one line item.';
  } else if (has('lines') && body.lines.length === 0) {
    fields.lines = 'Add at least one line item.';
  }
  if (
    has('status') &&
    !['draft', 'sent', 'partially_paid', 'paid', 'void'].includes(body.status)
  ) {
    fields.status = 'Choose a valid status.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export const invoiceHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────
  // Declared first so the :id routes below don't swallow them.

  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load invoices. Try again.');
  }),

  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      customerId: 'Choose a customer.',
      lines: 'Add at least one line item.',
    });
  }),

  // ── The five verbs ─────────────────────────────────────────────────────────

  /** GET /api/invoices — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(invoices, url, {
        searchFields: ['invoiceNumber', 'customerName'],
        filterKeys: ['status', 'customerId'],
      }),
    );
  }),

  /** GET /api/invoices/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = invoices.find((invoice) => invoice.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound('Invoice');
  }),

  /** POST /api/invoices — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const number = nextInvoiceNumber();
    const now = new Date().toISOString();
    const amountPaid = body.amountPaid ?? 0;

    const created = {
      ...body,
      id: `inv_${number}`,
      invoiceNumber: `INV-2026-${number}`,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      amountPaid,
      amountDue: 0, // recomputed properly once real totals exist
      createdAt: now,
      updatedAt: now,
    };

    invoices.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/invoices/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = invoices.findIndex((invoice) => invoice.id === params.id);
    if (index === -1) return notFound('Invoice');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    const updated = {
      ...invoices[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    // amountDue is always derived — recompute it whenever amountPaid changes.
    updated.amountDue = updated.grandTotal - updated.amountPaid;

    invoices[index] = updated;

    return HttpResponse.json({ data: updated });
  }),

  /** DELETE /api/invoices/:id — archive. 204, no body. */
  http.delete(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const index = invoices.findIndex((invoice) => invoice.id === params.id);
    if (index === -1) return notFound('Invoice');

    invoices.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];