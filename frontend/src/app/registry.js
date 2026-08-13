/**
 * Module registry — owned by A.
 *
 * The only file more than one person's work touches, and it is touched exactly
 * once per module, at the start. Each module exports its own routes, nav entry
 * and MSW handlers from `modules/<name>/index.js`; A adds one import line here
 * and then never again.
 *
 * See README § Registry pattern.
 */

// TODO(A): one import line per module as B and C land them, e.g.
// import { customerRoutes, customerNav, customerHandlers } from '@/modules/customers';

/** @type {import('react-router-dom').RouteObject[]} */
export const moduleRoutes = [];

/** @type {{ label: string, icon: unknown, path: string, permission: string }[]} */
export const moduleNav = [];

/** @type {unknown[]} MSW request handlers */
export const moduleHandlers = [];
