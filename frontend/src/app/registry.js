/**
 * Module registry — owned by A.
 *
 * The only file more than one person's work touches, and it is touched exactly
 * once per module, at the start: A adds one import line and three spreads, then
 * never again. Everything else about a module lives in the module's own folder.
 *
 * See README § Registry pattern.
 */

import {
  customerHandlers,
  customerNav,
  customerRoutes,
} from '@/modules/customers';
import {
  productHandlers,
  productNav,
  productRoutes,
} from '@/modules/products';
import {
  purchasingHandlers,
  purchasingNav,
  purchasingRoutes,
} from '@/modules/purchasing';
import {
  supplierHandlers,
  supplierNav,
  supplierRoutes,
} from '@/modules/suppliers';

// TODO(A): one import line per module as B and C land them —
// orders, invoices (B). C's three (products, suppliers, purchasing) are in.

/** @type {import('react-router-dom').RouteObject[]} */
export const moduleRoutes = [
  ...customerRoutes,
  ...productRoutes,
  ...supplierRoutes,
  ...purchasingRoutes,
];

/** @type {{ label: string, icon: unknown, path: string, permission: string }[]} */
export const moduleNav = [
  customerNav,
  productNav,
  supplierNav,
  purchasingNav,
];

/** @type {unknown[]} MSW request handlers */
export const moduleHandlers = [
  ...customerHandlers,
  ...productHandlers,
  ...supplierHandlers,
  ...purchasingHandlers,
];
