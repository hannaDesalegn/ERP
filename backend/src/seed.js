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
    name: 'admin',
    description: 'Full access to every module.',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  {
    name: 'manager',
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
    name: 'staff',
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

/** @returns {Promise<Map<string, import('mongoose').Document>>} role by name */
async function seedRoles() {
  const byName = new Map();

  for (const spec of ROLES) {
    let role = await Role.findOne({ name: spec.name });

    if (role) {
      // Permissions are the field that drifts, so a re-run refreshes them.
      // The _id stays put, which is what keeps existing users pointing at it.
      role.set(spec);
      await role.save();
      console.log(`role ${spec.name}: updated`);
    } else {
      role = await Role.create(spec);
      console.log(`role ${spec.name}: created`);
    }

    byName.set(spec.name, role);
  }

  return byName;
}

async function seedUsers(rolesByName) {
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
      roleId: rolesByName.get(spec.role)._id,
      status: 'active', // the model defaults to 'invited', which cannot log in
    });

    console.log(`user ${spec.email}: created (role ${spec.role})`);
  }
}

try {
  await connectDb(process.env.MONGO_URI);

  const rolesByName = await seedRoles();
  await seedUsers(rolesByName);

  console.log('Seed complete.');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  // Without this the connection holds the event loop open and node never exits.
  await mongoose.disconnect();
}
