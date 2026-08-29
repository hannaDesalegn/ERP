import 'dotenv/config'; // must be first — MONGO_URI is read below
import mongoose from 'mongoose';

import { connectDb } from './config/db.js';
import Role from './models/Role.js';
import User from './models/User.js';

/**
 * Seeds the three roles and three demo accounts so a real login works against a
 * real database. This mirrors ROLE_PERMISSIONS and the seed users in
 * frontend/src/mocks/authHandlers.js — when that file changes, this one has to
 * change with it. There is no mechanism keeping them in step.
 *
 * Safe to run repeatedly: roles match on name, users on email.
 */

/** The full catalogue from docs/entities.md § Permission strings. */
const ALL_PERMISSIONS = [
  'dashboard.view',
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'orders.view',
  'orders.create',
  'orders.edit',
  'orders.delete',
  'orders.approve',
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.void',
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.adjust_stock',
  'suppliers.view',
  'suppliers.create',
  'suppliers.edit',
  'suppliers.delete',
  'purchasing.view',
  'purchasing.create',
  'purchasing.edit',
  'purchasing.approve',
  'purchasing.receive',
  'reports.view',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'settings.view',
  'settings.edit',
];

const ROLES = [
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full access to every module.',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  {
    slug: 'manager',
    name: 'Manager',
    description: 'Customers and reports.',
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.delete',
      'reports.view',
    ],
    isSystem: false,
  },
  {
    slug: 'staff',
    name: 'Staff',
    description: 'Dashboard and customers, read only.',
    permissions: ['dashboard.view', 'customers.view'],
    isSystem: false,
  },
];

// Demo passwords, matching the mocks. Fine for a seeded dev database and
// nowhere else — these accounts must not exist in any deployed environment.
const USERS = [
  {
    email: 'admin@zion.test',
    password: 'admin123',
    firstName: 'Meron',
    lastName: 'Alemu',
    role: 'admin',
  },
  {
    email: 'manager@zion.test',
    password: 'manager123',
    firstName: 'Dawit',
    lastName: 'Bekele',
    role: 'manager',
  },
  {
    email: 'staff@zion.test',
    password: 'staff123',
    firstName: 'Sara',
    lastName: 'Girma',
    role: 'staff',
  },
];

/** @returns {Promise<Map<string, import('mongoose').Document>>} role by slug */
async function seedRoles() {
  const bySlug = new Map();

  for (const spec of ROLES) {
    // Match on slug, falling back to the name — rows seeded before slug
    // existed put what is now the slug in name. Finding the existing document
    // is the point: users reference the role by _id, so creating a second one
    // would leave every seeded user pointing at the abandoned row.
    let role =
      (await Role.findOne({ slug: spec.slug })) ??
      (await Role.findOne({ name: spec.slug }));

    if (role) {
      // Permissions are the field that drifts, so a re-run refreshes them.
      // The _id stays put, which is what keeps existing users pointing at it.
      role.set(spec);
      await role.save();
      console.log(`role ${spec.slug}: updated`);
    } else {
      role = await Role.create(spec);
      console.log(`role ${spec.slug}: created`);
    }

    bySlug.set(spec.slug, role);
  }

  // slug arrived after these rows did, so the unique index on it cannot build
  // while three of them still have no slug — Mongo sees three nulls and
  // rejects it, and the failure surfaces on an event rather than as a thrown
  // error, leaving the constraint quietly absent. Rebuilding here, once the
  // backfill above is committed, is the point at which it can succeed.
  await Role.syncIndexes();
  console.log('role indexes: synced');

  return bySlug;
}

async function seedUsers(rolesBySlug) {
  for (const spec of USERS) {
    if (await User.exists({ email: spec.email })) {
      // Left alone rather than reset: a re-run must not clobber a password
      // someone changed while testing.
      console.log(`user ${spec.email}: exists, unchanged`);
      continue;
    }

    // create() goes through save(), so the pre-save hook hashes the password.
    // An insertMany or updateOne here would store it in plaintext.
    await User.create({
      email: spec.email,
      password: spec.password,
      firstName: spec.firstName,
      lastName: spec.lastName,
      roleId: rolesBySlug.get(spec.role)._id,
      status: 'active', // the model defaults to 'invited', which cannot log in
    });

    console.log(`user ${spec.email}: created (role ${spec.role})`);
  }
}

try {
  await connectDb(process.env.MONGO_URI);

  const rolesBySlug = await seedRoles();
  await seedUsers(rolesBySlug);

  console.log('Seed complete.');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  // Without this the connection holds the event loop open and node never exits.
  await mongoose.disconnect();
}
