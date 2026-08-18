/**
 * Products MSW handlers — C owns this file.
 *
 * ROUTE ORDER MATTERS: MSW matches top to bottom, so any literal path that
 * could be mistaken for an :id — /products/categories, /products/demo-* —
 * must be declared BEFORE the /products/:id handler or it will never be
 * reached. This is the trap flagged in the customers module and it bites hard
 * here, because `categories` is a real endpoint rather than a test-only one.
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

import {
  adjustments,
  categories,
  nextAdjustmentNumber,
  nextProductNumber,
  products,
} from './mock';

const BASE = '/api/products';

/** Server-managed fields a client must never be able to set or change. */
const READ_ONLY_FIELDS = [
  'id',
  'sku',
  'categoryName',
  'quantityOnHand',
  'quantityReserved',
  'quantityAvailable',
  'createdAt',
  'updatedAt',
];

const UNITS = ['pcs', 'kg', 'ltr', 'box'];
const DIRECTIONS = ['increase', 'decrease'];
const REASONS = [
  'purchase',
  'sale',
  'damage',
  'loss',
  'count_correction',
  'return',
];

/** Mirror of schema.js. The server owns the real rules; this imitates them. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if ((!partial || has('name')) && !String(body.name ?? '').trim()) {
    fields.name = 'Enter a product name.';
  }
  if ((!partial || has('categoryId')) && !String(body.categoryId ?? '').trim()) {
    fields.categoryId = 'Choose a category.';
  }
  if (
    has('categoryId') &&
    body.categoryId &&
    !categories.some((category) => category.id === body.categoryId)
  ) {
    fields.categoryId = 'Choose a category.';
  }
  if (has('unitOfMeasure') && !UNITS.includes(body.unitOfMeasure)) {
    fields.unitOfMeasure = 'Choose a unit of measure.';
  }
  for (const key of ['costPrice', 'sellingPrice']) {
    if (has(key) && (!Number.isInteger(body[key]) || body[key] < 0)) {
      fields[key] = 'Must be zero or greater.';
    }
  }
  if (has('reorderLevel') && (!(body.reorderLevel >= 0) || Number.isNaN(body.reorderLevel))) {
    fields.reorderLevel = 'Must be zero or greater.';
  }
  if (has('status') && !['active', 'discontinued'].includes(body.status)) {
    fields.status = 'Choose a status.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/** Validation for the adjust-stock body. */
function validateAdjustment(body) {
  const fields = {};

  if (!DIRECTIONS.includes(body.direction)) {
    fields.direction = 'Choose increase or decrease.';
  }
  if (!(body.quantity > 0)) {
    fields.quantity = 'Enter a quantity above zero.';
  }
  if (!REASONS.includes(body.reason)) {
    fields.reason = 'Choose a reason.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/** Keep the server-calculated field consistent after any stock movement. */
function recalculateAvailable(product) {
  product.quantityAvailable = product.quantityOnHand - product.quantityReserved;
}

export const productHandlers = [
  // ── Literal paths, declared before /:id so they are reachable ──────────────

  /** GET /api/products/categories — the catalogue for the form's select. */
  http.get(`${BASE}/categories`, async () => {
    await delay();
    return HttpResponse.json({ data: categories });
  }),

  /** Always 500. Wire a button to this to see the list's error state. */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load products. Try again.');
  }),

  /** Always 422, with two field errors RHF can map onto inputs. */
  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      name: 'Enter a product name.',
      sellingPrice: 'An active product needs a selling price above zero.',
    });
  }),

  // ── The five verbs ─────────────────────────────────────────────────────────

  /** GET /api/products — list, paginated/sorted/filtered by the helper. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);

    // `lowStock` is a module-specific filter (docs/api-contract.md §2 allows
    // these), so it is applied here rather than inside the shared helper.
    const lowStockOnly = url.searchParams.get('lowStock') === 'true';
    const source = lowStockOnly
      ? products.filter(
          (product) => product.quantityAvailable <= product.reorderLevel,
        )
      : products;

    return HttpResponse.json(
      paginate(source, url, {
        searchFields: ['sku', 'name', 'categoryName', 'barcode'],
        filterKeys: ['status', 'categoryId', 'unitOfMeasure'],
      }),
    );
  }),

  /** GET /api/products/:id */
  http.get(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const found = products.find((product) => product.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound('Product');
  }),

  /** POST /api/products — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);

    const number = nextProductNumber();
    const now = new Date().toISOString();
    const category = categories.find(
      (item) => item.id === body.categoryId,
    );

    const created = {
      ...body,
      // Server-generated, so they overwrite anything the client sent.
      id: `prd_${number}`,
      sku: `PRD-${number}`,
      categoryName: category?.name ?? null,
      // A new product starts with no stock. It gains stock only through an
      // adjustment, never by the client sending a quantity.
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityAvailable: 0,
      createdAt: now,
      updatedAt: now,
    };

    products.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/products/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = products.findIndex((product) => product.id === params.id);
    if (index === -1) return notFound('Product');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);

    // Drop server-managed fields rather than trusting the body.
    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    // categoryName is denormalised, so the server re-derives it from the id.
    if (patch.categoryId) {
      patch.categoryName =
        categories.find((item) => item.id === patch.categoryId)?.name ?? null;
    }

    products[index] = {
      ...products[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: products[index] });
  }),

  /** DELETE /api/products/:id — archive. 204, no body. */
  http.delete(`${BASE}/:id`, async ({ params }) => {
    await delay();
    const index = products.findIndex((product) => product.id === params.id);
    if (index === -1) return notFound('Product');

    products.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Stock adjustments ──────────────────────────────────────────────────────

  /** GET /api/products/:id/adjustments — movement history, newest first. */
  http.get(`${BASE}/:id/adjustments`, async ({ params, request }) => {
    await delay();
    const product = products.find((item) => item.id === params.id);
    if (!product) return notFound('Product');

    const rows = adjustments.filter((row) => row.productId === params.id);
    const url = new URL(request.url);
    if (!url.searchParams.get('sort')) url.searchParams.set('sort', '-createdAt');

    return HttpResponse.json(
      paginate(rows, url, {
        searchFields: ['reason', 'reference', 'notes'],
        filterKeys: ['direction', 'reason'],
      }),
    );
  }),

  /**
   * POST /api/products/:id/adjustments — the only way stock changes.
   *
   * Rejects a decrease that would take stock negative: an ERP that lets you
   * ship what you do not have is worse than one that refuses. 409 rather than
   * 422 because the body is well-formed — the current state is what forbids it.
   */
  http.post(`${BASE}/:id/adjustments`, async ({ params, request }) => {
    await delay();
    const product = products.find((item) => item.id === params.id);
    if (!product) return notFound('Product');

    const body = await request.json();

    const fields = validateAdjustment(body);
    if (fields) return validationError(fields);

    const signed =
      body.direction === 'increase' ? body.quantity : -body.quantity;

    if (product.quantityOnHand + signed < 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot remove ${body.quantity} — only ${product.quantityOnHand} in stock.`,
          },
        },
        { status: 409 },
      );
    }

    const number = nextAdjustmentNumber();

    const created = {
      id: `adj_${number}`,
      productId: product.id,
      productName: product.name, // denormalised at the time of the movement
      direction: body.direction,
      quantity: body.quantity,
      reason: body.reason,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      createdBy: 'usr_0001', // server-set from the session
      createdAt: new Date().toISOString(),
    };

    adjustments.push(created);

    product.quantityOnHand += signed;
    recalculateAvailable(product);
    product.updatedAt = created.createdAt;

    return HttpResponse.json(
      { data: created },
      {
        status: 201,
        headers: { Location: `${BASE}/${product.id}/adjustments/${created.id}` },
      },
    );
  }),
];
