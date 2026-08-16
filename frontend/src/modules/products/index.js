/**
 * Products module registry export — C owns this file entirely.
 *
 * The ONLY file A's registry imports. Three named exports, always the same
 * three: <noun>Routes, <noun>Nav, <noun>Handlers. A adds one import line to
 * src/app/registry.js when the module first lands, and then never touches it.
 */

import { Package } from 'lucide-react';

import { productHandlers } from './handlers';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { ProductListPage } from './pages/ProductListPage';

/** Sidebar entry. `permission` hides it from users who lack the right. */
export const productNav = {
  label: 'Products',
  icon: Package,
  path: '/products',
  permission: 'products.view',
};

/**
 * Route objects, spread into the tree by A's router.
 *
 * `Component:` rather than `element: <Page />` on purpose — it keeps this file
 * free of JSX so it can stay `index.js` as the README structure specifies.
 *
 * ROUTE ORDER: /products/new must come before /products/:id, or "new" is read
 * as an id and the detail page 404s.
 */
export const productRoutes = [
  { path: '/products', Component: ProductListPage },
  { path: '/products/new', Component: ProductFormPage },
  { path: '/products/:id', Component: ProductDetailPage },
  { path: '/products/:id/edit', Component: ProductFormPage },
];

export { productHandlers };
