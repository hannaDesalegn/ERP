/**
 * Commercial seed — customers, sales orders and invoices.
 *
 * src/seed.js creates the roles and the three accounts; src/seedOperations.js
 * fills the operations side (categories, products, suppliers, purchase orders,
 * stock adjustments). Nothing filled the commercial side, so customers, sales
 * orders and invoices were empty collections on a deployed database. This file
 * closes that gap, so that the security team has records to test against rather
 * than three endpoints that return an empty page.
 *
 * Run it last, because it needs both of the others:
 *   npm run seed             # roles and users            (A)
 *   npm run seed:operations  # products and suppliers     (C)
 *   npm run seed:commercial  # this file
 *
 * ── Two rules this file follows, and why they matter for testing ─────────────
 *
 * 1. Every number is calculated with the SAME arithmetic as the route that
 *    would have produced the record. buildLinesAndTotals in routes/orders.js
 *    and routes/invoices.js is reproduced below, rounding step for rounding
 *    step. A tester comparing a seeded order's grandTotal against its lines is
 *    therefore checking the server's maths, not this script's. Any mismatch
 *    they find is a real finding.
 *
 * 2. Line items copy productName, sku and unitPrice from the REAL product
 *    documents in the database, the way a route does at the moment the line is
 *    added. Nothing here invents a price. That is also why this file reads
 *    products out of Mongo instead of importing the frontend product fixtures:
 *    the ids have to be the ones the API will return.
 *
 * Customers come from the frontend fixture rather than being retyped, following
 * the same reasoning as seedOperations.js — one set of invented records, not
 * two that drift. Their `balance` is the exception and is recomputed here from
 * the invoices actually seeded, so the figure on a customer agrees with their
 * invoice list.
 *
 * Deterministic: the shape of the data comes from a fixed-seed generator, so
 * two runs against the same product catalogue produce the same records. A
 * tester can report "INV-2026-0023" and it means the same invoice to us.
 *
 * Idempotent, and destructive about it: the three collections are cleared
 * before inserting. Re-running it during a test window destroys records the
 * testers created. Say so before you run it.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDb } from './config/db.js';
import { Customer } from './models/Customer.js';
import { Invoice } from './models/Invoice.js';
import { SalesOrder } from './models/SalesOrder.js';
import Product from './models/Product.js';
import User from './models/User.js';

// Frontend fixture. It imports nothing at runtime, which is what makes reading
// it from the backend safe — same reasoning as seedOperations.js.
import { customers as customerFixtures } from '../../frontend/src/modules/customers/mock.js';

// ── Determinism ─────────────────────────────────────────────────────────────

/**
 * A fixed-seed linear congruential generator. The other mock files hand-write
 * their seed rows to stay deterministic; at this volume that would be three
 * hundred lines of tuples nobody would read. A constant seed gives the same
 * guarantee: the same dataset every time.
 *
 * @param {number} seed
 * @returns {() => number} next value in [0, 1)
 */
function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = makeRng(20260915);

/** @returns {number} integer in [min, max], both inclusive */
function intBetween(min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** @template T @param {T[]} items @returns {T} */
function pick(items) {
  return items[Math.floor(rng() * items.length)];
}

// ── Dates ───────────────────────────────────────────────────────────────────

// Fixed at process start so every date in one run is relative to one instant.
const NOW = new Date();

/** @returns {Date} */
function daysBefore(days) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** @returns {string} YYYY-MM-DD, the form entities.md specifies for date-only fields */
function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/** @param {string} isoDay @returns {string} YYYY-MM-DD */
function addDays(isoDay, days) {
  const d = new Date(isoDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnly(d);
}

/**
 * Spreads `count` records evenly from `oldest` days ago up to today.
 *
 * The obvious version of this — a fixed step per index — quietly leaves a gap
 * at the near end: forty invoices at seven days apart start three hundred days
 * back and stop a month short of today, so every unpaid invoice is already past
 * its payment terms and the not-yet-due case never occurs in the data. Ending
 * the range on today is what puts records on both sides of their due date.
 *
 * @param {number} index
 * @param {number} count
 * @param {number} oldest days before today for the first record
 * @returns {number} days before today for this record
 */
function spreadDaysAgo(index, count, oldest) {
  if (count <= 1) return oldest;
  return Math.round(oldest - (index * oldest) / (count - 1));
}

/** A timestamp inside the working day, so createdAt is not midnight for all of them. */
function stampOn(isoDay, hour, minute) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(isoDay + 'T' + hh + ':' + mm + ':00Z');
}

/**
 * Saves with the timestamps plugin switched off so createdAt survives.
 * Without this every seeded record is created "now", the whole dataset shares
 * one date, and ?dateFrom=/?dateTo= and sorting by createdAt have nothing to
 * bite on — which is exactly the kind of filtering a tester wants to push.
 * The model's own pre-save hooks still run, so Invoice.amountDue is still
 * derived rather than written.
 */
async function saveBackdated(doc) {
  await doc.save({ timestamps: false });
  return doc;
}

// ── Server arithmetic, reproduced ───────────────────────────────────────────

/**
 * Identical to buildLinesAndTotals in routes/orders.js, including the order of
 * the roundings. Note that `subtotal` there is the sum of the GROSS line
 * values, before discount — copied as-is rather than corrected, because a seed
 * that disagreed with the route would send testers after a bug of our making.
 *
 * @param {Array<{ product: object, quantity: number, discountPercent: number, taxPercent: number }>} inputs
 */
function buildOrderLines(inputs) {
  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const input of inputs) {
    const { product } = input;
    const gross = product.sellingPrice * input.quantity;
    const lineDiscount = Math.round((gross * input.discountPercent) / 100);
    const afterDiscount = gross - lineDiscount;
    const lineTax = Math.round((afterDiscount * input.taxPercent) / 100);
    const lineTotal = afterDiscount + lineTax;

    lines.push({
      productId: product._id,
      productName: product.name, // denormalised now, frozen from here on
      sku: product.sku,
      unitPrice: product.sellingPrice,
      quantity: input.quantity,
      discountPercent: input.discountPercent,
      taxPercent: input.taxPercent,
      lineTotal,
    });

    subtotal += gross;
    discountTotal += lineDiscount;
    taxTotal += lineTax;
  }

  return {
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal - discountTotal + taxTotal,
  };
}

/**
 * Identical to buildLinesAndTotals in routes/invoices.js. The Invoice entity
 * has no discount field at all, which is why this takes no discountPercent.
 * See eligibleForInvoice below for what that costs us.
 *
 * @param {Array<{ product: object, quantity: number, taxPercent: number }>} inputs
 */
function buildInvoiceLines(inputs) {
  const lines = [];
  let subtotal = 0;
  let taxTotal = 0;

  for (const input of inputs) {
    const { product } = input;
    const gross = product.sellingPrice * input.quantity;
    const lineTax = Math.round((gross * input.taxPercent) / 100);

    lines.push({
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.sellingPrice,
      quantity: input.quantity,
      taxPercent: input.taxPercent,
      lineTotal: gross + lineTax,
    });

    subtotal += gross;
    taxTotal += lineTax;
  }

  return { lines, subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}

// ── Shape of the dataset ────────────────────────────────────────────────────

/**
 * How many records land in each status. Written out rather than left to the
 * generator because the counts are the point: a status with no records in it
 * is a transition nobody can test. Every status in both enums appears here.
 */
const ORDER_STATUS_PLAN = [
  ['draft', 8],
  ['pending_approval', 7],
  ['approved', 12],
  ['fulfilled', 15],
  ['cancelled', 6],
];

const INVOICE_STATUS_PLAN = [
  ['draft', 5],
  ['sent', 12],
  ['partially_paid', 8],
  ['paid', 12],
  ['void', 3],
];

/** 15% VAT is the ordinary case; the zero-rated lines keep the tax maths honest. */
const TAX_RATES = [15, 15, 15, 15, 0];

/** Most lines carry no discount. Kept small so rounding is exercised, not dominated. */
const DISCOUNT_RATES = [0, 0, 0, 0, 5, 10, 12.5];

/**
 * How many orders are built with no discount on any line, so that there are
 * enough of them to raise invoices against.
 *
 * Leaving this to chance does not work: with a discount on roughly two lines in
 * five and two and a half lines to an order, only four orders in forty-eight
 * came out clean, and four linked invoices is too thin for anyone to exercise
 * the order-to-invoice relationship. Choosing them up front makes the number
 * something we decide rather than something we hope for.
 */
const INVOICEABLE_ORDERS = 14;

/**
 * Turns a plan into one status per record, then shuffles.
 *
 * The shuffle is the important half. Dates in both loops below march forward
 * with the index, so an unshuffled plan makes status and age the same fact:
 * every draft is among the oldest records and every cancelled order among the
 * newest. That is not what a ledger looks like, and it takes a whole class of
 * test case off the table — with the statuses in blocks, every unpaid invoice
 * lands far enough in the past to be overdue, so nothing exercises the
 * not-yet-due branch of the derived status.
 *
 * @param {[string, number][]} plan
 * @returns {string[]} one entry per record, order decorrelated from status
 */
function expandPlan(plan) {
  const expanded = plan.flatMap(([status, count]) =>
    Array.from({ length: count }, () => status),
  );

  // Fisher-Yates, drawing from the same fixed-seed generator as everything
  // else, so the result is still the same on every run.
  for (let i = expanded.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
  }

  return expanded;
}

// ── Seeding ─────────────────────────────────────────────────────────────────

/**
 * The three seeded accounts, so that records are not all attributed to the
 * administrator. Section 4 of the pentest handover asks the team to look at
 * object-level access, and that is untestable if every record in the database
 * has the same owner — there is nothing to reach across to.
 */
async function resolveUsers() {
  const users = await User.find({
    email: {
      $in: ['admin@zion.test', 'manager@zion.test', 'staff@zion.test'],
    },
  });

  if (!users.length) {
    throw new Error('No seeded users found. Run `npm run seed` first.');
  }

  return users;
}

async function resolveProducts() {
  // Discontinued products, and the ones the fixtures give a zero selling price,
  // are not things a salesperson would put on an order.
  const products = await Product.find({
    status: 'active',
    sellingPrice: { $gt: 0 },
  }).sort({ sku: 1 });

  if (!products.length) {
    throw new Error(
      'No sellable products found. Run `npm run seed:operations` first.',
    );
  }

  return products;
}

async function seedCustomers() {
  const removed = await Customer.deleteMany({});
  const created = [];

  for (const [index, fixture] of customerFixtures.entries()) {
    // id, balance and the fixture's own timestamps are all dropped: the first
    // is a mock-only key, the second is recomputed below, and the last two are
    // replaced with dates that are actually in the past.
    const { id, balance, createdAt, updatedAt, ...fields } = fixture;

    // Oldest customer first, so code order and creation order agree.
    const when = daysBefore(700 - index * 22);

    created.push(
      await saveBackdated(
        new Customer({
          ...fields,
          balance: 0, // recomputed from the invoices at the end of the run
          createdAt: when,
          updatedAt: when,
        }),
      ),
    );
  }

  return { created, removed: removed.deletedCount };
}

/**
 * Customers are not sampled evenly. A handful carry most of the trade, which
 * is both what a real ledger looks like and what makes
 * GET /api/customers/:id/orders worth paginating.
 */
function buildCustomerPool(customers) {
  const heavy = customers.filter((c) => c.status === 'active').slice(0, 6);
  const rest = customers.filter((c) => c.status !== 'blocked');
  return [...heavy, ...heavy, ...heavy, ...rest];
}

async function seedOrders(customers, products, users) {
  const removed = await SalesOrder.deleteMany({});
  const statuses = expandPlan(ORDER_STATUS_PLAN);
  const pool = buildCustomerPool(customers);
  const created = [];
  const year = NOW.getFullYear();

  // The orders that will carry no discount on any line, chosen from the ones
  // whose status allows an invoice. See INVOICEABLE_ORDERS.
  const undiscounted = new Set();
  for (const [index, status] of statuses.entries()) {
    const invoiceable = status === 'approved' || status === 'fulfilled';
    if (invoiceable && undiscounted.size < INVOICEABLE_ORDERS) {
      undiscounted.add(index);
    }
  }

  for (const [index, status] of statuses.entries()) {
    const customer = pick(pool);
    const author = pick(users);

    const lineInputs = Array.from({ length: intBetween(1, 4) }, () => ({
      product: pick(products),
      quantity: intBetween(1, 40),
      discountPercent: undiscounted.has(index) ? 0 : pick(DISCOUNT_RATES),
      taxPercent: pick(TAX_RATES),
    }));

    const totals = buildOrderLines(lineInputs);

    // The oldest order is SO-<year>-0001 and dates march forward with the
    // sequence, so the numbering and the chronology do not contradict.
    const orderDay = dateOnly(
      daysBefore(spreadDaysAgo(index, statuses.length, 360)),
    );
    const stamp = stampOn(orderDay, intBetween(8, 16), intBetween(0, 59));

    // An order that never reached approval was never approved by anyone.
    const wasApproved = status === 'approved' || status === 'fulfilled';

    created.push(
      await saveBackdated(
        new SalesOrder({
          orderNumber:
            'SO-' + year + '-' + String(index + 1).padStart(4, '0'),
          customerId: customer._id,
          customerName: customer.name, // denormalised, frozen at order time
          orderDate: orderDay,
          expectedDeliveryDate:
            rng() < 0.8 ? addDays(orderDay, intBetween(5, 30)) : null,
          lines: totals.lines,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          currency: customer.currency,
          status,
          notes: null,
          createdBy: author._id,
          approvedBy: wasApproved ? pick(users)._id : null,
          createdAt: stamp,
          updatedAt: stamp,
        }),
      ),
    );
  }

  return { created, removed: removed.deletedCount };
}

/**
 * Which fulfilled orders can be turned into an invoice without the totals
 * disagreeing.
 *
 * A SalesOrder line has discountPercent; an Invoice line does not — the entity
 * simply has no discount field. So an invoice raised against a discounted order
 * cannot carry that order's grand total, and seeding one would hand the test
 * team a mismatch that is a modelling gap in the entity, not a bug in the code
 * they are testing. Only undiscounted orders are invoiced here, which means an
 * invoice whose grandTotal differs from its sales order IS worth reporting.
 *
 * The gap itself is written up in docs/pentest-handover.md rather than hidden.
 */
function eligibleForInvoice(order) {
  // Approved as well as fulfilled: an invoice is raised once the order is
  // agreed, not only once the goods have gone out. Restricting this to
  // fulfilled orders left four linked invoices out of forty, which is too few
  // for anyone to exercise the order-to-invoice relationship properly.
  const invoiceable = order.status === 'approved' || order.status === 'fulfilled';

  return (
    invoiceable && order.lines.every((line) => line.discountPercent === 0)
  );
}

async function seedInvoices(customers, products, users, orders) {
  const removed = await Invoice.deleteMany({});
  const statuses = expandPlan(INVOICE_STATUS_PLAN);
  const pool = buildCustomerPool(customers);
  const fromOrders = orders.filter(eligibleForInvoice);
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  const created = [];
  const year = NOW.getFullYear();

  for (const [index, status] of statuses.entries()) {
    // The first few invoices are raised against real fulfilled orders; the rest
    // are standalone, because entities.md allows an invoice with no order
    // behind it (a walk-in sale) and that path needs records too.
    const source = fromOrders[index] ?? null;
    const customer = source ? byId.get(String(source.customerId)) : pick(pool);

    const lineInputs = source
      ? source.lines.map((line) => ({
          // Rebuilt from the product so unitPrice comes from the same place the
          // route would take it, rather than being copied out of the order.
          product: products.find((p) => String(p._id) === String(line.productId)),
          quantity: line.quantity,
          taxPercent: line.taxPercent,
        }))
      : Array.from({ length: intBetween(1, 3) }, () => ({
          product: pick(products),
          quantity: intBetween(1, 25),
          taxPercent: pick(TAX_RATES),
        }));

    // A product deleted since the order was raised would leave a hole here.
    if (lineInputs.some((input) => !input.product)) continue;

    const totals = buildInvoiceLines(lineInputs);

    // An invoice follows its order by a few days — but the newest orders are
    // dated today, and an invoice issued in the future is not a record the
    // application could ever have produced. Clamped rather than left to run
    // past today.
    const today = dateOnly(NOW);
    const afterOrder = source
      ? addDays(source.orderDate, intBetween(2, 12))
      : null;

    const issueDay = afterOrder
      ? (afterOrder > today ? today : afterOrder)
      : dateOnly(daysBefore(spreadDaysAgo(index, statuses.length, 300)));

    // The customer's own payment terms decide the due date, so the terms field
    // is not decorative and a due-date calculation has something to be wrong
    // about. Terms of 0 days still need a due date, hence the floor.
    const dueDay = addDays(issueDay, Math.max(customer.paymentTermsDays, 7));

    let amountPaid = 0;
    if (status === 'paid') amountPaid = totals.grandTotal;
    if (status === 'partially_paid') {
      amountPaid = Math.round((totals.grandTotal * intBetween(20, 80)) / 100);
    }

    const stamp = stampOn(issueDay, intBetween(8, 16), intBetween(0, 59));

    created.push(
      await saveBackdated(
        new Invoice({
          invoiceNumber:
            'INV-' + year + '-' + String(index + 1).padStart(4, '0'),
          salesOrderId: source ? source._id : null,
          customerId: customer._id,
          customerName: customer.name, // denormalised
          issueDate: issueDay,
          dueDate: dueDay,
          lines: totals.lines,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          amountPaid,
          // amountDue is not set here on purpose — the model's pre-save hook
          // derives it. If that hook ever stops running, this seed says so.
          currency: customer.currency,
          status,
          notes: null,
          createdAt: stamp,
          updatedAt: stamp,
        }),
      ),
    );
  }

  return { created, removed: removed.deletedCount };
}

/**
 * Customer.balance is what the customer owes: the money out on invoices that
 * have been issued and not yet settled. A draft invoice has not been sent and a
 * void one has been withdrawn, so neither counts.
 *
 * Worth knowing, and stated in the handover: no route maintains this field. It
 * is set to 0 on create and never touched again, so recording a payment does
 * not move it. Computing it here gives the figure on a customer a meaning that
 * agrees with their invoice list at the moment of seeding, and nothing keeps
 * the two in step afterwards.
 */
async function recomputeCustomerBalances(customers, invoices) {
  const owed = new Map();

  for (const invoice of invoices) {
    if (invoice.status !== 'sent' && invoice.status !== 'partially_paid') {
      continue;
    }
    const key = String(invoice.customerId);
    owed.set(key, (owed.get(key) ?? 0) + invoice.amountDue);
  }

  let overLimit = 0;

  for (const customer of customers) {
    const balance = owed.get(String(customer._id)) ?? 0;

    if (balance !== customer.balance) {
      customer.balance = balance;
      await saveBackdated(customer);
    }

    // Not corrected: a customer past their credit limit is a state the system
    // can genuinely reach, and the interesting question is what the application
    // lets you do to one.
    if (balance > customer.creditLimit) overLimit += 1;
  }

  return { overLimit };
}

// ── Reporting ───────────────────────────────────────────────────────────────

function countByStatus(records) {
  const counts = new Map();
  for (const record of records) {
    counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => status + ' ' + count)
    .join(', ');
}

/** Invoices the API will report as 'overdue', which is derived and never stored. */
function countOverdue(invoices) {
  return invoices.filter(
    (invoice) =>
      (invoice.status === 'sent' || invoice.status === 'partially_paid') &&
      invoice.amountDue > 0 &&
      new Date(invoice.dueDate) < NOW,
  ).length;
}

function countByCreator(orders, users) {
  const byId = new Map(users.map((user) => [String(user._id), user.email]));
  const counts = new Map();
  for (const order of orders) {
    const email = byId.get(String(order.createdBy)) ?? 'unknown';
    counts.set(email, (counts.get(email) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([email, count]) => email + ' ' + count)
    .join(', ');
}

async function run() {
  await connectDb(process.env.MONGO_URI);

  const users = await resolveUsers();
  const products = await resolveProducts();

  console.log(
    'Using ' +
      users.length +
      ' account(s) and ' +
      products.length +
      ' sellable product(s).',
  );
  console.log('Clearing customers, sales orders and invoices before inserting.');

  const customerResult = await seedCustomers();
  const orderResult = await seedOrders(customerResult.created, products, users);
  const invoiceResult = await seedInvoices(
    customerResult.created,
    products,
    users,
    orderResult.created,
  );
  const balances = await recomputeCustomerBalances(
    customerResult.created,
    invoiceResult.created,
  );

  const fromOrders = invoiceResult.created.filter((i) => i.salesOrderId).length;

  console.log('\nCommercial seed complete:');
  console.log(
    '  customers     ' +
      customerResult.created.length +
      ' (replaced ' +
      customerResult.removed +
      ')',
  );
  console.log(
    '  sales orders  ' +
      orderResult.created.length +
      ' (replaced ' +
      orderResult.removed +
      ')',
  );
  console.log(
    '  invoices      ' +
      invoiceResult.created.length +
      ' (replaced ' +
      invoiceResult.removed +
      ')',
  );

  console.log('\nFor whoever is testing this:');
  console.log('  order status            ' + countByStatus(orderResult.created));
  console.log('  invoice status          ' + countByStatus(invoiceResult.created));
  console.log(
    '  reads as overdue        ' +
      countOverdue(invoiceResult.created) +
      ' (derived on read, never stored)',
  );
  console.log('  invoices from an order  ' + fromOrders);
  console.log(
    '  orders by creator       ' + countByCreator(orderResult.created, users),
  );
  console.log('  customers over limit    ' + balances.overLimit);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  // A seed is a developer script; the real error is what is wanted here.
  console.error('Commercial seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
