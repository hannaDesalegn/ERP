/**
 * Order module registry export.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * This is the ONLY file the registry imports. Three named exports, always the
 * same three: <noun>Routes, <noun>Nav, <noun>Handlers.
 * One import line is added to src/app/registry.js when the module first lands,
 * and then never touches it again. Everything after that is yours.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {  ShoppingCart } from 'lucide-react';
import { OrderFormPage } from './pages/OrderFormPage';
import { orderHandlers } from './handlers';
import { OrderListPage } from './pages/OrderListPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
/** Sidebar entry. `permission` hides it from users who lack the right. */
export const orderNav = {
  label: 'Orders',
  icon: ShoppingCart,
  path: '/orders',
  permission: 'orders.view',
};


/**
 * Route objects, spread into the tree by the router.
 *
 * `Component:` rather than `element: <Page />` on purpose — it keeps this file
 * free of JSX so it can stay `index.js` as the README structure specifies.
 */

export const orderRoutes = [
  { path: '/orders', Component: OrderListPage },
  { path: '/orders/new', Component: OrderFormPage },
  { path: '/orders/:id', Component: OrderDetailPage },
  { path: '/orders/:id/edit', Component: OrderFormPage },
];

export { orderHandlers };