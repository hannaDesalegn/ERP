/**
 * Module registry — owned by A.
 *
 * The only file more than one person's work touches, and it is touched exactly
 * once per module, at the start: A adds one import line and three spreads, then
 * never again. Everything else about a module lives in the module's own folder.
 *
 * See README § Registry pattern.
 */

import { LayoutDashboard } from 'lucide-react';

import {
  customerHandlers,
  customerNav,
  customerRoutes,
} from '@/modules/customers';
import { orderHandlers, orderNav, orderRoutes } from '@/modules/orders';

// TODO(B): invoices is held out of the registry — registering it breaks the
// build. src/modules/invoices/api.js is still the copied customers file: it
// exports customerKeys/fetchCustomers against RESOURCE = '/customers', but
// InvoiceListPage.jsx imports { invoiceKeys, fetchInvoices }. Rename the
// exports and the RESOURCE, then uncomment the import and the three spreads
// below. index.js and handlers.js are already correct.
// import {
//   invoiceHandlers,
//   invoiceNav,
//   invoiceRoutes,
// } from '@/modules/invoices';

// TODO(A): one import line per module as C lands them —
// products, suppliers, purchasing.

/** @type {import('react-router-dom').RouteObject[]} */
export const moduleRoutes = [
  ...customerRoutes,
  ...orderRoutes,
  // ...invoiceRoutes,
];

/**
 * Sidebar order, not alphabetical: it follows the business flow a user works
 * through — customer, then their order, then the invoice for it.
 *
 * @type {{ label: string, icon: unknown, path: string, permission: string }[]}
 */
export const moduleNav = [
  // Dashboard is A's own page, not a module, but this list is what both the
  // sidebar and the breadcrumb labels read. Keeping it anywhere else means a
  // second nav array plus a STATIC_LABELS entry for the same one link.
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    permission: 'dashboard.view',
  },
  customerNav,
  orderNav,
  // invoiceNav,
];

/** @type {unknown[]} MSW request handlers */
export const moduleHandlers = [
  ...customerHandlers,
  ...orderHandlers,
  // ...invoiceHandlers,
];
