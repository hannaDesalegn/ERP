/**
 * Customers module registry export — B owns this file entirely.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * This is the ONLY file A's registry imports. Three named exports, always the
 * same three: <noun>Routes, <noun>Nav, <noun>Handlers.
 * A adds one import line to src/app/registry.js when the module first lands,
 * and then never touches it again. Everything after that is yours.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Users } from 'lucide-react';

import { customerHandlers } from './handlers';
import { CustomerListPage } from './pages/CustomerListPage';
import { CustomerFormPage } from './pages/CustomerFormPage';

/** Sidebar entry. `permission` hides it from users who lack the right. */
export const customerNav = {
  label: 'Customers',
  icon: Users,
  path: '/customers',
  permission: 'customers.view',
};

/**
 * Route objects, spread into the tree by A's router.
 *
 * `Component:` rather than `element: <Page />` on purpose — it keeps this file
 * free of JSX so it can stay `index.js` as the README structure specifies.
 *
 * TODO(B): detail and form pages — /customers/:id and /customers/:id/edit.
 */

export const customerRoutes = [ 
  { path: '/customers', Component: CustomerListPage }, 
  { path: '/customers/new', Component: CustomerFormPage }, 
  { path: '/customers/:id/edit', Component: CustomerFormPage }, ];

export { customerHandlers };
