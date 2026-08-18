/**
 * Suppliers module registry export — C owns this file entirely.
 *
 * The ONLY file A's registry imports. Three named exports, always the same
 * three: <noun>Routes, <noun>Nav, <noun>Handlers.
 */

import { Truck } from 'lucide-react';

import { supplierHandlers } from './handlers';
import { SupplierDetailPage } from './pages/SupplierDetailPage';
import { SupplierFormPage } from './pages/SupplierFormPage';
import { SupplierListPage } from './pages/SupplierListPage';

/** Sidebar entry. `permission` hides it from users who lack the right. */
export const supplierNav = {
  label: 'Suppliers',
  icon: Truck,
  path: '/suppliers',
  permission: 'suppliers.view',
};

/**
 * ROUTE ORDER: /suppliers/new must come before /suppliers/:id, or "new" is
 * read as an id and the detail page 404s.
 */
export const supplierRoutes = [
  { path: '/suppliers', Component: SupplierListPage },
  { path: '/suppliers/new', Component: SupplierFormPage },
  { path: '/suppliers/:id', Component: SupplierDetailPage },
  { path: '/suppliers/:id/edit', Component: SupplierFormPage },
];

export { supplierHandlers };
