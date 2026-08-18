/**
 * Invoice module registry export — B owns this file entirely.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * This is the ONLY file A's registry imports. Three named exports, always the
 * same three: <noun>Routes, <noun>Nav, <noun>Handlers.
 * A adds one import line to src/app/registry.js when the module first lands,
 * and then never touches it again. Everything after that is yours.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Receipt } from 'lucide-react';

import { invoiceHandlers } from './handlers';
import { InvoiceListPage } from './pages/InvoiceListPage';

/** Sidebar entry. `permission` hides it from users who lack the right. */
export const invoiceNav = {
  label: 'Invoices',
  icon: Receipt,
  path: '/invoices',
  permission: 'invoices.view',
};

/**
 * Route objects, spread into the tree by A's router.
 *
 * `Component:` rather than `element: <Page />` on purpose — it keeps this file
 * free of JSX so it can stay `index.js` as the README structure specifies.
 *
 * TODO(B): detail and form pages — /invoices/:id and /invoices/:id/edit.
 */
export const invoiceRoutes = [
  { path: '/invoices', Component: InvoiceListPage },
];

export { invoiceHandlers };