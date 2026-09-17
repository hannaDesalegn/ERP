/**
 * Operations seed.
 *
 * Populates products, categories, stock adjustments, suppliers and purchase
 * orders. src/seed.js creates the roles, the admin account and one record
 * per collection so the app boots; this fills the operations side with enough
 * data to actually demonstrate and test against.
 *
 * Run it after the base seed:
 *   npm run seed            # roles, users, minimal records
 *   npm run seed:operations # this file
 *
 * The fixtures are imported from the frontend module folders rather than
 * retyped here. They were written for the mock API and are already the exact
 * shapes docs/entities.md specifies, so duplicating them would only create two
 * sets of fake data that drift apart. Those files import nothing, which is what
 * makes reading them from here safe.
 *
 * Idempotent: it clears the five operations collections before inserting, so
 * running it twice gives the same result rather than duplicates.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDb } from './config/db.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import StockAdjustment from './models/StockAdjustment.js';
import Supplier from './models/Supplier.js';
import User from './models/User.js';

// Frontend fixtures. Relative paths, because the two halves of the project are
// siblings in one repository.
import {
  adjustments as adjustmentFixtures,
  categories as categoryFixtures,
  products as productFixtures,
} from '../../frontend/src/modules/products/mock.js';
import { purchaseOrders as purchaseOrderFixtures } from '../../frontend/src/modules/purchasing/mock.js';
import { suppliers as supplierFixtures } from '../../frontend/src/modules/suppliers/mock.js';

/**
 * The fixtures use readable string ids (prd_0001, sup_0003). Mongo generates
 * ObjectIds. This keeps a map from the fixture id to the real one so that
 * references between documents survive the import.
 */
const idMap = new Map();

/**
 * createdBy and approvedBy are real User references. The fixtures carry a
 * placeholder ("usr_0001") because the mock API had no user collection, so
 * every seeded record is attributed to an account that actually exists.
 */
let seedUserId = null;

async function resolveSeedUser() {
  const user =
    (await User.findOne({ email: 'admin@zion.test' })) ?? (await User.findOne());

  if (!user) {
    throw new Error('No users found. Run `npm run seed` first to create them.');
  }

  seedUserId = user._id;
}

/** Strip the fixture's own id and any server-calculated field. */
function withoutFixtureKeys(record, extraKeys = []) {
  const copy = { ...record };
  ['id', 'createdAt', 'updatedAt', ...extraKeys].forEach((key) => {
    delete copy[key];
  });
  return copy;
}

async function seedCategories() {
  await Category.deleteMany({});
  for (const fixture of categoryFixtures) {
    const created = await Category.create({ name: fixture.name });
    idMap.set(fixture.id, created._id);
  }
  return categoryFixtures.length;
}

async function seedProducts() {
  await Product.deleteMany({});
  for (const fixture of productFixtures) {
    const created = await Product.create({
      ...withoutFixtureKeys(fixture, ['quantityAvailable']),
      // The fixture's categoryId is a string key; swap it for the real one.
      categoryId: idMap.get(fixture.categoryId),
    });
    idMap.set(fixture.id, created._id);
  }
  return productFixtures.length;
}

async function seedAdjustments() {
  await StockAdjustment.deleteMany({});
  let count = 0;
  for (const fixture of adjustmentFixtures) {
    const productId = idMap.get(fixture.productId);
    // A movement whose product did not import is meaningless, so skip rather
    // than insert a dangling reference.
    if (!productId) continue;
    await StockAdjustment.create({
      ...withoutFixtureKeys(fixture),
      productId,
      createdBy: seedUserId,
    });
    count += 1;
  }
  return count;
}

async function seedSuppliers() {
  await Supplier.deleteMany({});
  for (const fixture of supplierFixtures) {
    const created = await Supplier.create(withoutFixtureKeys(fixture));
    idMap.set(fixture.id, created._id);
  }
  return supplierFixtures.length;
}

async function seedPurchaseOrders() {
  await PurchaseOrder.deleteMany({});
  let count = 0;

  for (const fixture of purchaseOrderFixtures) {
    const supplierId = idMap.get(fixture.supplierId);
    if (!supplierId) continue;

    // Line items reference products by fixture id too.
    const lines = (fixture.lines ?? []).map((line) => ({
      ...withoutFixtureKeys(line),
      productId: idMap.get(line.productId) ?? undefined,
    }));

    await PurchaseOrder.create({
      ...withoutFixtureKeys(fixture),
      supplierId,
      lines,
      createdBy: seedUserId,
      // Only an order that actually reached approval carries an approver.
      approvedBy: fixture.approvedBy ? seedUserId : null,
    });
    count += 1;
  }

  return count;
}

async function run() {
  await connectDb(process.env.MONGO_URI);
  await resolveSeedUser();

  // Order matters: categories before products, products and suppliers before
  // the records that point at them.
  const categories = await seedCategories();
  const products = await seedProducts();
  const adjustments = await seedAdjustments();
  const suppliers = await seedSuppliers();
  const purchaseOrders = await seedPurchaseOrders();

  console.log('Operations seed complete:');
  console.log(`  categories        ${categories}`);
  console.log(`  products          ${products}`);
  console.log(`  stock adjustments ${adjustments}`);
  console.log(`  suppliers         ${suppliers}`);
  console.log(`  purchase orders   ${purchaseOrders}`);

  await mongoose.disconnect();
}

run().catch((error) => {
  // Seeding is a developer script, so the real error is what is wanted here.
  console.error('Operations seed failed:', error.message);
  process.exit(1);
});
