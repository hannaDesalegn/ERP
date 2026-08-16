/**
 * Purchase orders MSW handlers — C owns this file.
 *
 * ROUTE ORDER MATTERS: MSW matches top to bottom. The literal demo paths are
 * declared before /:id, and the action routes (/:id/submit etc.) are more
 * specific than /:id so they resolve correctly.
 *
 * This file is where the illegal-transition rules live. They are the reason
 * status changes are POST actions rather than a PATCH of a status field —
 * docs/api-contract.md § Status transitions are POST actions.
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
  calculateLineTotal,
  calculateTotals,
  lookupProduct,
  lookupSupplier,
  nextPurchaseOrderNumber,
  purchaseOrders,
} from './mock';

const BASE = '/api/purchase-orders';

/** Which statuses each action is legal from. Deny by default. */
const ALLOWED_FROM = {
  submit: ['draft'],
  approve: ['pending_approval'],
  receive: ['approved', 'partially_received'],
  cancel: ['draft', 'pending_approval', 'approved', 'partially_received'],
};

/** An order may only be edited while it is still a draft. */
const EDITABLE_STATUSES = ['draft'];

/** 409 in the standard error shape. The body is fine; the state forbids it. */
function conflict(message) {
  return HttpResponse.json(
    { error: { code: 'CONFLICT', message } },
    { status: 409 },
  );
}

/** Mirror of schema.js. The server owns the real rules; this imitates them. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if ((!partial || has('supplierId')) && !String(body.supplierId ?? '').trim()) {
    fields.supplierId = 'Choose a supplier.';
  }
  if ((!partial || has('orderDate')) && !/^\d{4}-\d{2}-\d{2}$/.test(body.orderDate ?? '')) {
    fields.orderDate = 'Use the date picker.';
  }
  if (
    has('expectedDate') &&
    body.expectedDate &&
    body.orderDate &&
    body.expectedDate < body.orderDate
  ) {
    fields.expectedDate = 'Expected date cannot be before the order date.';
  }
  if ((!partial || has('lines')) && !(body.lines?.length > 0)) {
    fields.lines = 'Add at least one line before saving.';
  }
  if (has('lines')) {
    for (const line of body.lines ?? []) {
      if (!line.productId) fields.lines = 'Every line needs a product.';
      else if (!(line.quantity > 0)) {
        fields.lines = 'Every line needs a quantity above zero.';
      } else if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
        fields.lines = 'Every line needs a valid unit price.';
      }
    }
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Build server-owned line records from what the client sent.
 * The client never supplies lineTotal, quantityReceived, productName or sku —
 * the server derives all four, which is what stops a crafted body rewriting
 * history or the totals.
 */
function buildLines(order, body) {
  return (body.lines ?? []).map((line, index) => {
    // An existing line for the same product keeps its id and its denormalised
    // name, so editing an order does not silently rewrite what was ordered.
    const existing = order?.lines?.find(
      (candidate) => candidate.productId === line.productId,
    );
    // New lines are denormalised from the catalogue, server-side. The client
    // never sends productName or sku.
    const product = lookupProduct(line.productId);

    const built = {
      id: existing?.id ?? `pol_new_${index + 1}_${Date.now()}`,
      productId: line.productId,
      productName: existing?.productName ?? product?.name ?? line.productId,
      sku: existing?.sku ?? product?.sku ?? line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent ?? 0,
      taxPercent: line.taxPercent ?? 0,
      quantityReceived: existing?.quantityReceived ?? 0,
      lineTotal: 0,
    };

    built.lineTotal = calculateLineTotal(built);
    return built;
  });
}

/** Re-derive status from what has actually arrived. */
function statusAfterReceipt(order) {
  const fullyReceived = order.lines.every(
    (line) => line.quantityReceived >= line.quantity,
  );
  return fullyReceived ? 'received' : 'partially_received';
}

export const purchaseOrderHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────

  /** Always 500. Wire a button to this to see the list's error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load purchase orders. Try again.');
  }),

  /** Always 422, with two field errors RHF can map onto inputs. */
  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      supplierId: 'Choose a supplier.',
      lines: 'Add at least one line before saving.',
    });
  }),

  // ── Status transitions ─────────────────────────────────────────────────────
  // Declared before /:id so the action segment is never read as part of an id.

  /** POST /api/purchase-orders/:id/submit — draft → pending_approval. */
  http.post(`${BASE}/:id/submit`, async ({ params }) => {
    await delay();
    const order = purchaseOrders.find((item) => item.id === params.id);
    if (!order) return notFound('Purchase order');

    if (!ALLOWED_FROM.submit.includes(order.status)) {
      return conflict(
        `A ${order.status.replace('_', ' ')} order cannot be submitted.`,
      );
    }
    if (order.lines.length === 0) {
      return conflict('Add at least one line before submitting.');
    }

    order.status = 'pending_approval';
    order.updatedAt = new Date().toISOString();
    return HttpResponse.json({ data: order });
  }),

  /** POST /api/purchase-orders/:id/approve — pending_approval → approved. */
  http.post(`${BASE}/:id/approve`, async ({ params }) => {
    await delay();
    const order = purchaseOrders.find((item) => item.id === params.id);
    if (!order) return notFound('Purchase order');

    if (!ALLOWED_FROM.approve.includes(order.status)) {
      return conflict(
        `Only an order awaiting approval can be approved. This one is ${order.status.replace('_', ' ')}.`,
      );
    }

    order.status = 'approved';
    // Server-set from the session, never from the request body.
    order.approvedBy = 'usr_0002';
    order.updatedAt = new Date().toISOString();
    return HttpResponse.json({ data: order });
  }),

  /** POST /api/purchase-orders/:id/cancel — → cancelled. */
  http.post(`${BASE}/:id/cancel`, async ({ params }) => {
    await delay();
    const order = purchaseOrders.find((item) => item.id === params.id);
    if (!order) return notFound('Purchase order');

    if (!ALLOWED_FROM.cancel.includes(order.status)) {
      return conflict(
        `A ${order.status.replace('_', ' ')} order cannot be cancelled.`,
      );
    }

    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    return HttpResponse.json({ data: order });
  }),

  /**
   * POST /api/purchase-orders/:id/receive — record a delivery.
   *
   * Rejects receiving more than was ordered. Over-receipt is how stock records
   * quietly stop matching the warehouse, and it is exactly the kind of thing
   * people dispute later, so the server refuses rather than absorbing it.
   */
  http.post(`${BASE}/:id/receive`, async ({ params, request }) => {
    await delay();
    const order = purchaseOrders.find((item) => item.id === params.id);
    if (!order) return notFound('Purchase order');

    if (!ALLOWED_FROM.receive.includes(order.status)) {
      return conflict(
        `Goods can only be received against an approved order. This one is ${order.status.replace('_', ' ')}.`,
      );
    }

    const body = await request.json();
    const entries = body.lines ?? [];

    if (entries.length === 0) {
      return validationError({ lines: 'Enter what actually arrived.' });
    }

    // Validate the whole delivery before applying any of it — a half-applied
    // receipt is worse than a rejected one.
    for (const entry of entries) {
      const line = order.lines.find((candidate) => candidate.id === entry.lineId);
      if (!line) return notFound('Order line');

      const quantity = entry.quantityReceived;
      if (!(quantity >= 0)) {
        return validationError({ lines: 'Quantities must be zero or greater.' });
      }

      const outstanding = line.quantity - line.quantityReceived;
      if (quantity > outstanding) {
        return conflict(
          `${line.sku}: only ${outstanding} outstanding, but ${quantity} entered.`,
        );
      }
    }

    if (entries.every((entry) => entry.quantityReceived === 0)) {
      return validationError({ lines: 'Enter at least one quantity above zero.' });
    }

    for (const entry of entries) {
      const line = order.lines.find((candidate) => candidate.id === entry.lineId);
      line.quantityReceived += entry.quantityReceived;
    }

    order.status = statusAfterReceipt(order);
    order.updatedAt = new Date().toISOString();

    return HttpResponse.json({ data: order });
  }),

  // ── The standard verbs ─────────────────────────────────────────────────────

  /** GET /api/purchase-orders — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(purchaseOrders, url, {
        searchFields: ['poNumber', 'supplierName'],
        filterKeys: ['status', 'supplierId'],
      }),
    );
  }),

  /** GET /api/purchase-orders/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = purchaseOrders.find((order) => order.id === params.id);
    return found
      ? HttpResponse.json({ data: found })
      : notFound('Purchase order');
  }),

  /** POST /api/purchase-orders — 201 + Location header. Always a draft. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const supplier = lookupSupplier(body.supplierId);
    if (!supplier) return validationError({ supplierId: 'Choose a supplier.' });

    const number = nextPurchaseOrderNumber();
    const now = new Date().toISOString();

    const created = {
      id: `po_${number}`,
      poNumber: `PO-2026-${number}`, // server-generated
      supplierId: body.supplierId,
      supplierName: supplier.name, // denormalised server-side from the id
      orderDate: body.orderDate,
      expectedDate: body.expectedDate ?? null,
      lines: [],
      currency: body.currency ?? 'ETB',
      // Created as a draft. Status moves only through the POST actions, never
      // through the request body.
      status: 'draft',
      notes: body.notes ?? null,
      createdBy: 'usr_0001', // server-set from the session
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    created.lines = buildLines(null, body);
    Object.assign(created, calculateTotals(created.lines));

    purchaseOrders.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /**
   * PATCH /api/purchase-orders/:id — partial update.
   *
   * Only while the order is a draft. Editing quantities or prices after
   * approval would make the approval meaningless, so the server refuses.
   */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = purchaseOrders.findIndex((order) => order.id === params.id);
    if (index === -1) return notFound('Purchase order');

    const order = purchaseOrders[index];

    if (!EDITABLE_STATUSES.includes(order.status)) {
      return conflict(
        `Only a draft order can be edited. This one is ${order.status.replace('_', ' ')}.`,
      );
    }

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    // A changed supplier re-derives the denormalised name server-side.
    if (body.supplierId && body.supplierId !== order.supplierId) {
      const supplier = lookupSupplier(body.supplierId);
      if (!supplier) {
        return validationError({ supplierId: 'Choose a supplier.' });
      }
      order.supplierName = supplier.name;
    }

    const updated = {
      ...order,
      supplierId: body.supplierId ?? order.supplierId,
      orderDate: body.orderDate ?? order.orderDate,
      expectedDate:
        body.expectedDate === undefined ? order.expectedDate : body.expectedDate,
      currency: body.currency ?? order.currency,
      notes: body.notes === undefined ? order.notes : body.notes,
      updatedAt: new Date().toISOString(),
    };

    if (body.lines) {
      updated.lines = buildLines(order, body);
      Object.assign(updated, calculateTotals(updated.lines));
    }

    purchaseOrders[index] = updated;
    return HttpResponse.json({ data: updated });
  }),
];
