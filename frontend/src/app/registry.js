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

// TODO(A): one import line per module as B and C land them —
// orders, invoices (B); products, suppliers, purchasing (C).

/** @type {import('react-router-dom').RouteObject[]} */
export const moduleRoutes = [...customerRoutes];

/** @type {{ label: string, icon: unknown, path: string, permission: string }[]} */
export const moduleNav = [customerNav];

/** @type {unknown[]} MSW request handlers */
export const moduleHandlers = [...customerHandlers];
