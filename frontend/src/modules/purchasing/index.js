/**
 * Purchasing module registry export — C owns this file entirely.
 *
 * The ONLY file A's registry imports. Three named exports, always the same
 * three: <noun>Routes, <noun>Nav, <noun>Handlers.
 */

import { ClipboardList } from 'lucide-react';

import { purchaseOrderHandlers } from './handlers';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
import { PurchaseOrderFormPage } from './pages/PurchaseOrderFormPage';
import { PurchaseOrderListPage } from './pages/PurchaseOrderListPage';

/** Sidebar entry. `permission` hides it from users who lack the right. */
export const purchasingNav = {
  label: 'Purchase orders',
  icon: ClipboardList,
  path: '/purchase-orders',
  permission: 'purchasing.view',
};

/**
 * ROUTE ORDER: /purchase-orders/new must come before /purchase-orders/:id, or
 * "new" is read as an id and the detail page 404s.
 */
export const purchasingRoutes = [
  { path: '/purchase-orders', Component: PurchaseOrderListPage },
  { path: '/purchase-orders/new', Component: PurchaseOrderFormPage },
  { path: '/purchase-orders/:id', Component: PurchaseOrderDetailPage },
  { path: '/purchase-orders/:id/edit', Component: PurchaseOrderFormPage },
];

export { purchaseOrderHandlers as purchasingHandlers };
