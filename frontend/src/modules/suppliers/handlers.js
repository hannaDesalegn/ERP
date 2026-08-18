/**
 * Suppliers MSW handlers — C owns this file.
 *
 * ROUTE ORDER MATTERS: MSW matches top to bottom, so any literal path that
 * could be mistaken for an :id — like /suppliers/demo-server-error — must be
 * declared BEFORE the /suppliers/:id handler or it will never be reached.
 *
 * Mock the failures, not just the happy path.
 */

import { http, HttpResponse } from 'msw';

import {
  delay,
  notFound,
  paginate,
  serverError,
  validationError,
} from '@/mocks/helpers';

import {
  nextSupplierNumber,
  supplierPurchaseOrders,
  suppliers,
} from './mock';

const BASE = '/api/suppliers';

/** Server-managed fields a client must never be able to set or change. */
const READ_ONLY_FIELDS = ['id', 'code', 'balance', 'createdAt', 'updatedAt'];

/** Mirror of schema.js. The server owns the real rules; this imitates them. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if ((!partial || has('name')) && !String(body.name ?? '').trim()) {
    fields.name = 'Enter a supplier name.';
  }
  if (
    has('email') &&
    body.email !== null &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)
  ) {
    fields.email = 'Must be a valid email address.';
  }
  if (
    has('paymentTermsDays') &&
    (!Number.isInteger(body.paymentTermsDays) ||
      body.paymentTermsDays < 0 ||
      body.paymentTermsDays > 365)
  ) {
    fields.paymentTermsDays = 'Must be between 0 and 365 days.';
  }
  if (has('status') && !['active', 'inactive'].includes(body.status)) {
    fields.status = 'Choose a status.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export const supplierHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────
  // Declared first so the :id routes below don't swallow them.

  /** Always 500. Wire a button to this to see the list's error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load suppliers. Try again.');
  }),

  /** Always 422, with two field errors RHF can map onto inputs. */
  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      email: 'Must be a valid email address.',
      paymentTermsDays: 'Must be between 0 and 365 days.',
    });
  }),

  // ── The five verbs ─────────────────────────────────────────────────────────

  /** GET /api/suppliers — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(suppliers, url, {
        searchFields: ['code', 'name', 'email', 'phone', 'contactPerson'],
        filterKeys: ['status'],
      }),
    );
  }),

  /** GET /api/suppliers/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = suppliers.find((supplier) => supplier.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound('Supplier');
  }),

  /** POST /api/suppliers — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const number = nextSupplierNumber();
    const now = new Date().toISOString();

    const created = {
      ...body,
      // Server-generated, so they overwrite anything the client sent.
      id: `sup_${number}`,
      code: `SUP-${number}`,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    };

    suppliers.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/suppliers/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = suppliers.findIndex((supplier) => supplier.id === params.id);
    if (index === -1) return notFound('Supplier');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    // Drop server-managed fields rather than trusting the body.
    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    suppliers[index] = {
      ...suppliers[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: suppliers[index] });
  }),

  /**
   * DELETE /api/suppliers/:id — archive. 204, no body.
   *
   * Refuses while purchase orders are still open against the supplier: an ERP
   * that lets you delete the counterparty of a live commitment produces
   * unresolvable history. 409, because the request is well-formed and it is the
   * current state that forbids it.
   */
  http.delete(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const index = suppliers.findIndex((supplier) => supplier.id === params.id);
    if (index === -1) return notFound('Supplier');

    const openStatuses = ['pending_approval', 'approved', 'partially_received'];
    const open = supplierPurchaseOrders.filter(
      (order) =>
        order.supplierId === params.id && openStatuses.includes(order.status),
    );

    if (open.length > 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `This supplier has ${open.length} open purchase order${
              open.length === 1 ? '' : 's'
            }. Close or cancel them first.`,
          },
        },
        { status: 409 },
      );
    }

    suppliers.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Module-specific endpoints ──────────────────────────────────────────────

  /** GET /api/suppliers/:id/purchase-orders — read-only, newest first. */
  http.get(`${BASE}/:id/purchase-orders`, async ({ params, request }) => {
    await delay();
    const supplier = suppliers.find((item) => item.id === params.id);
    if (!supplier) return notFound('Supplier');

    const rows = supplierPurchaseOrders.filter(
      (order) => order.supplierId === params.id,
    );

    const url = new URL(request.url);
    if (!url.searchParams.get('sort')) {
      url.searchParams.set('sort', '-orderDate');
    }

    return HttpResponse.json(
      paginate(rows, url, {
        searchFields: ['poNumber'],
        filterKeys: ['status'],
      }),
    );
  }),
];
