/**
 * Operations smoke test.
 *
 * Exercises every operations endpoint against a running server and a real
 * database, and asserts the authorisation boundaries rather than only the happy
 * path. It is deliberately plain Node with no test framework, so it can be
 * pointed at a deployed URL as easily as at localhost:
 *
 *   node src/smokeOperations.js
 *   BASE_URL=https://erp-api.example.com node src/smokeOperations.js
 *
 * Written because the operations routes were built and merged without ever
 * running against MongoDB. Structural checks pass on code that is still wrong
 * about what the database does.
 */

import 'dotenv/config';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);

/**
 * Test-account credentials come from the environment. They were literals here
 * until the passwords were rotated; keeping them in the source put working
 * credentials for a deployed environment into the repository and its history.
 *
 * Set before running:
 *   TEST_ADMIN_PASSWORD, TEST_MANAGER_PASSWORD, TEST_STAFF_PASSWORD
 */
const ACCOUNTS = {
  admin: { email: 'admin@zion.test', password: process.env.TEST_ADMIN_PASSWORD },
  manager: { email: 'manager@zion.test', password: process.env.TEST_MANAGER_PASSWORD },
  staff: { email: 'staff@zion.test', password: process.env.TEST_STAFF_PASSWORD },
};

// Fail here rather than reporting a run of authentication failures that look
// like findings. Names only — never the values.
const missingCredentials = Object.entries(ACCOUNTS)
  .filter(([, account]) => !account.password)
  .map(([role]) => `TEST_${role.toUpperCase()}_PASSWORD`);

if (missingCredentials.length > 0) {
  console.error(
    `Missing test-account credentials: ${missingCredentials.join(', ')}.\n` +
      'These are supplied separately and are not stored in the repository.',
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** @returns {Promise<{ status: number, body: any }>} */
async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, body: payload };
}

async function login(role) {
  const { status, body } = await call('/auth/login', {
    method: 'POST',
    body: ACCOUNTS[role],
  });
  if (status !== 200) {
    throw new Error(`Could not sign in as ${role}: HTTP ${status}`);
  }
  return body.data.accessToken;
}

async function main() {
  console.log(`Operations smoke test against ${BASE_URL}\n`);

  // ── Authentication ────────────────────────────────────────────────────────
  console.log('Authentication');
  const tokens = {};
  for (const role of Object.keys(ACCOUNTS)) {
    tokens[role] = await login(role);
    check(`${role} can sign in`, Boolean(tokens[role]));
  }

  const badLogin = await call('/auth/login', {
    method: 'POST',
    body: { email: ACCOUNTS.admin.email, password: 'wrong-password' },
  });
  check('wrong password is rejected', badLogin.status === 401, `got ${badLogin.status}`);

  // ── Unauthenticated access ────────────────────────────────────────────────
  console.log('\nUnauthenticated access is refused');
  for (const path of ['/products', '/suppliers', '/purchase-orders']) {
    const res = await call(path);
    check(`GET ${path} without a token is 401`, res.status === 401, `got ${res.status}`);
  }

  // ── Reads as administrator ────────────────────────────────────────────────
  console.log('\nReads');
  const products = await call('/products', { token: tokens.admin });
  check('GET /products returns 200', products.status === 200, `got ${products.status}`);
  check(
    'products come back in the { data, meta } envelope',
    Array.isArray(products.body?.data) && typeof products.body?.meta?.total === 'number',
  );
  check('products are seeded', (products.body?.meta?.total ?? 0) > 0, `total ${products.body?.meta?.total}`);

  const suppliers = await call('/suppliers', { token: tokens.admin });
  check('GET /suppliers returns 200', suppliers.status === 200, `got ${suppliers.status}`);
  check('suppliers are seeded', (suppliers.body?.meta?.total ?? 0) > 0);

  const orders = await call('/purchase-orders', { token: tokens.admin });
  check('GET /purchase-orders returns 200', orders.status === 200, `got ${orders.status}`);

  const categories = await call('/products/categories', { token: tokens.admin });
  check(
    'GET /products/categories is reachable and not swallowed by /:id',
    categories.status === 200 && Array.isArray(categories.body?.data),
    `got ${categories.status}`,
  );

  // Pagination must be real, not the whole array returned every time.
  const pageOne = await call('/products?perPage=5&page=1', { token: tokens.admin });
  const pageTwo = await call('/products?perPage=5&page=2', { token: tokens.admin });
  check('perPage is honoured', pageOne.body?.data?.length === 5, `got ${pageOne.body?.data?.length}`);
  check(
    'page 2 differs from page 1',
    pageOne.body?.data?.[0]?.id !== pageTwo.body?.data?.[0]?.id,
  );

  const perPageCap = await call('/products?perPage=5000', { token: tokens.admin });
  check(
    'perPage is capped server-side',
    (perPageCap.body?.meta?.perPage ?? 9999) <= 100,
    `got ${perPageCap.body?.meta?.perPage}`,
  );

  // ── Authorisation boundaries ──────────────────────────────────────────────
  console.log('\nAuthorisation');
  for (const role of ['manager', 'staff']) {
    const res = await call('/products', { token: tokens[role] });
    check(
      `${role} without products.view is refused`,
      res.status === 403 || res.status === 404,
      `got ${res.status}`,
    );
  }

  const staffCreate = await call('/products', {
    token: tokens.staff,
    method: 'POST',
    body: { name: 'Should not exist', categoryId: 'x', unitOfMeasure: 'pcs' },
  });
  check('staff cannot create a product', staffCreate.status >= 400, `got ${staffCreate.status}`);

  // ── Validation ────────────────────────────────────────────────────────────
  console.log('\nValidation');
  const invalid = await call('/products', {
    token: tokens.admin,
    method: 'POST',
    body: { name: '', unitOfMeasure: 'furlongs', costPrice: -5 },
  });
  check('an invalid product is rejected with 422', invalid.status === 422, `got ${invalid.status}`);
  check(
    '422 carries field-level messages',
    invalid.body?.error?.code === 'VALIDATION_FAILED' && Boolean(invalid.body?.error?.fields),
  );

  const missing = await call('/products/000000000000000000000000', { token: tokens.admin });
  check('an unknown id is 404', missing.status === 404, `got ${missing.status}`);

  // ── Create, update, and server-managed fields ─────────────────────────────
  console.log('\nWrites');
  const categoryId = categories.body?.data?.[0]?.id;
  const created = await call('/products', {
    token: tokens.admin,
    method: 'POST',
    body: {
      name: 'Smoke Test Widget',
      description: null,
      categoryId,
      unitOfMeasure: 'pcs',
      costPrice: 1000,
      sellingPrice: 2500,
      currency: 'ETB',
      reorderLevel: 5,
      barcode: null,
      imageUrl: null,
      status: 'active',
      // Fields the client must never be able to set.
      sku: 'HACKED-0001',
      quantityOnHand: 999999,
    },
  });
  check('a valid product is created with 201', created.status === 201, `got ${created.status}`);

  const newProduct = created.body?.data;
  check('server generates the SKU, ignoring the client', newProduct?.sku !== 'HACKED-0001', `got ${newProduct?.sku}`);
  check('a new product starts with no stock', newProduct?.quantityOnHand === 0, `got ${newProduct?.quantityOnHand}`);

  // ── Stock adjustments ─────────────────────────────────────────────────────
  console.log('\nStock adjustments');
  if (newProduct?.id) {
    const increase = await call(`/products/${newProduct.id}/adjustments`, {
      token: tokens.admin,
      method: 'POST',
      body: { direction: 'increase', quantity: 10, reason: 'purchase', reference: null, notes: null },
    });
    check('stock can be increased', increase.status === 201, `got ${increase.status}`);

    const after = await call(`/products/${newProduct.id}`, { token: tokens.admin });
    check('quantity reflects the movement', after.body?.data?.quantityOnHand === 10, `got ${after.body?.data?.quantityOnHand}`);
    check(
      'available quantity is recalculated',
      after.body?.data?.quantityAvailable === after.body?.data?.quantityOnHand - after.body?.data?.quantityReserved,
    );

    const overdraw = await call(`/products/${newProduct.id}/adjustments`, {
      token: tokens.admin,
      method: 'POST',
      body: { direction: 'decrease', quantity: 500, reason: 'sale', reference: null, notes: null },
    });
    check('stock cannot be driven negative', overdraw.status === 409, `got ${overdraw.status}`);

    const history = await call(`/products/${newProduct.id}/adjustments`, { token: tokens.admin });
    check('movement history is recorded', (history.body?.meta?.total ?? 0) >= 1);

    // Clean up the product this run created.
    await call(`/products/${newProduct.id}`, { token: tokens.admin, method: 'DELETE' });
  }

  // ── Purchase order lifecycle ──────────────────────────────────────────────
  console.log('\nPurchase order lifecycle');
  const supplierId = suppliers.body?.data?.[0]?.id;
  const lineProduct = products.body?.data?.[0];

  if (supplierId && lineProduct) {
    const draft = await call('/purchase-orders', {
      token: tokens.admin,
      method: 'POST',
      body: {
        supplierId,
        orderDate: '2026-09-01',
        expectedDate: null,
        currency: 'ETB',
        notes: null,
        lines: [
          {
            productId: lineProduct.id,
            quantity: 10,
            unitPrice: 5000,
            discountPercent: 0,
            taxPercent: 15,
          },
        ],
        // Client-supplied totals must be discarded.
        grandTotal: 1,
        subtotal: 1,
      },
    });
    check('a purchase order is created', draft.status === 201, `got ${draft.status}`);

    const po = draft.body?.data;
    check('a new order starts as draft', po?.status === 'draft', `got ${po?.status}`);
    check('totals are calculated server-side, not taken from the client', po?.grandTotal !== 1, `got ${po?.grandTotal}`);
    check(
      'grand total matches the line maths',
      po?.grandTotal === Math.round(10 * 5000 * 1.15),
      `got ${po?.grandTotal}`,
    );

    if (po?.id) {
      // Approving a draft skips a state and must be refused.
      const skip = await call(`/purchase-orders/${po.id}/approve`, { token: tokens.admin, method: 'POST' });
      check('draft cannot jump straight to approved', skip.status === 409, `got ${skip.status}`);

      const submitted = await call(`/purchase-orders/${po.id}/submit`, { token: tokens.admin, method: 'POST' });
      check('draft can be submitted', submitted.status === 200, `got ${submitted.status}`);
      check('status becomes pending_approval', submitted.body?.data?.status === 'pending_approval');

      const edit = await call(`/purchase-orders/${po.id}`, {
        token: tokens.admin,
        method: 'PATCH',
        body: { notes: 'should be refused' },
      });
      check('a submitted order can no longer be edited', edit.status === 409, `got ${edit.status}`);

      const approved = await call(`/purchase-orders/${po.id}/approve`, { token: tokens.admin, method: 'POST' });
      check('pending order can be approved', approved.status === 200, `got ${approved.status}`);

      const overReceive = await call(`/purchase-orders/${po.id}/receive`, {
        token: tokens.admin,
        method: 'POST',
        body: { lines: [{ lineId: approved.body?.data?.lines?.[0]?.id, quantityReceived: 999 }] },
      });
      check('cannot receive more than was ordered', overReceive.status >= 400, `got ${overReceive.status}`);

      const partial = await call(`/purchase-orders/${po.id}/receive`, {
        token: tokens.admin,
        method: 'POST',
        body: { lines: [{ lineId: approved.body?.data?.lines?.[0]?.id, quantityReceived: 4 }] },
      });
      check('a partial delivery is accepted', partial.status === 200, `got ${partial.status}`);
      check(
        'partial delivery sets partially_received',
        partial.body?.data?.status === 'partially_received',
        `got ${partial.body?.data?.status}`,
      );

      const full = await call(`/purchase-orders/${po.id}/receive`, {
        token: tokens.admin,
        method: 'POST',
        body: { lines: [{ lineId: approved.body?.data?.lines?.[0]?.id, quantityReceived: 6 }] },
      });
      check('completing the delivery sets received', full.body?.data?.status === 'received', `got ${full.body?.data?.status}`);

      const lateCancel = await call(`/purchase-orders/${po.id}/cancel`, { token: tokens.admin, method: 'POST' });
      check('a received order cannot be cancelled', lateCancel.status === 409, `got ${lateCancel.status}`);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nSmoke test could not run:', error.message);
  process.exit(1);
});
