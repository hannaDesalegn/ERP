import { Router } from 'express';

import { Customer } from '../models/Customer.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

/**
 * GET /api/dashboard/summary — KPI cards + recent activity.
 *
 * A single resource, so the envelope is { data } with no meta: recentActivity is
 * a field inside that object rather than a bare array at the top level, and it
 * takes no query parameters.
 *
 * ── What is real and what is not ─────────────────────────────────────────────
 *
 * REAL — computed per request, from a collection that exists:
 *
 *   activeCustomers      Customer.countDocuments({ status: 'active' })
 *   activeUsers          User.countDocuments({ status: 'active' })
 *
 * STATIC — the collection behind it does not exist yet:
 *
 *   revenueThisMonth     Invoices / payments
 *   ordersThisMonth      Orders
 *   averageOrderValue    derived from the two order figures
 *   outstandingBalance   Invoices
 *   overdueInvoices      Invoices
 *   recentActivity       order / invoice / payment / customer events
 *
 * Both real counts filter on status: 'active', which Customer and User each
 * declare as an enum with 'active' as one member — Customer's is
 * active/inactive/blocked and defaults to active, User's is
 * active/invited/suspended. There is no customer seed script to match against,
 * so the filter follows the model rather than a fixture.
 *
 * activeCustomers counts Customers and not Users, which is the whole point of
 * it having waited for the Customer model: DashboardPage renders this card
 * under the title "Active customers", and a count of staff accounts beneath
 * that label would have been a real number meaning the wrong thing. The user
 * count has its own activeUsers key. The page reads six KPIs by name rather
 * than iterating, so that extra key renders nothing until someone adds a card.
 *
 * Neither real count carries a `trend`. A month-over-month comparison needs
 * history to compare against, which a current-state count cannot produce on its
 * own — so activeCustomers has dropped the static trend it inherited from the
 * mock rather than pairing a real value with an invented 4.8%. KPICard treats
 * trend as optional and omits the row. The five static KPIs keep theirs, being
 * placeholder figures through and through.
 *
 * The static values match frontend/src/mocks/dashboardHandlers.js exactly, so
 * swapping the mock for this endpoint changes nothing on the page. Money is an
 * integer in minor units — 486250000 is 4,862,500.00 ETB — and nothing here is
 * a pre-formatted string: formatting is the page's job, and a formatted number
 * on the wire is a number you can no longer do arithmetic on.
 */
const summary = {
  /**
   * Each card carries its trend in the shape KPICard takes: a magnitude, a
   * direction, whether that direction is good news, and the comparison spelled
   * out in the label. `isGood` is stated only on the two where a rise is bad
   * news; the others leave it off, which is what the card renders by default.
   */
  kpis: {
    revenueThisMonth: {
      value: 486250000, // minor units
      currency: 'ETB',
      trend: { value: 8.4, direction: 'up', label: 'vs last month' },
    },
    ordersThisMonth: {
      value: 128, // a count, not money — no currency
      trend: { value: 3.2, direction: 'up', label: 'vs last month' },
    },
    // activeCustomers is absent here on purpose — it is computed per request
    // below. Leaving a static 21 in place that every response overwrote would
    // read as a fallback that could still surface, which it cannot.
    averageOrderValue: {
      value: 3798828, // revenueThisMonth / ordersThisMonth, floored
      currency: 'ETB',
      trend: { value: 1.6, direction: 'down', label: 'vs last month' },
    },
    outstandingBalance: {
      value: 120490000,
      currency: 'ETB',
      trend: {
        value: 6.2,
        direction: 'up',
        isGood: false, // a growing debt is not good news
        label: 'vs last month',
      },
    },
    overdueInvoices: {
      value: 31200000,
      currency: 'ETB',
      trend: {
        value: 3.5,
        direction: 'down',
        isGood: true, // less overdue is good news
        label: 'vs last month',
      },
    },
  },

  /**
   * A short, fixed feed — not a paginated collection, which is why it has no
   * meta of its own. `amount` is null where the event has no money attached;
   * the page renders that as an em dash.
   */
  recentActivity: [
    {
      id: 'act_0001',
      type: 'order',
      reference: 'ORD-0043',
      description: 'Order approved',
      amount: 12450000,
      currency: 'ETB',
      actor: 'Meron Alemu',
      occurredAt: '2026-08-18T09:12:00Z',
    },
    {
      id: 'act_0002',
      type: 'invoice',
      reference: 'INV-0117',
      description: 'Invoice sent',
      amount: 8600000,
      currency: 'ETB',
      actor: 'Dawit Bekele',
      occurredAt: '2026-08-18T08:40:00Z',
    },
    {
      id: 'act_0003',
      type: 'payment',
      reference: 'INV-0112',
      description: 'Payment recorded',
      amount: 4500000,
      currency: 'ETB',
      actor: 'Sara Girma',
      occurredAt: '2026-08-17T16:05:00Z',
    },
    {
      id: 'act_0004',
      type: 'customer',
      reference: 'CUS-0031',
      description: 'Customer added — Meki Plastics PLC',
      amount: null,
      currency: null,
      actor: 'Meron Alemu',
      occurredAt: '2026-08-17T14:22:00Z',
    },
    {
      id: 'act_0005',
      type: 'order',
      reference: 'ORD-0042',
      description: 'Order submitted for approval',
      amount: 3120000,
      currency: 'ETB',
      actor: 'Sara Girma',
      occurredAt: '2026-08-17T11:48:00Z',
    },
    {
      id: 'act_0006',
      type: 'invoice',
      reference: 'INV-0116',
      description: 'Invoice created from ORD-0041',
      amount: 21750000,
      currency: 'ETB',
      actor: 'Dawit Bekele',
      occurredAt: '2026-08-16T15:30:00Z',
    },
    {
      id: 'act_0007',
      type: 'order',
      reference: 'ORD-0040',
      description: 'Order cancelled',
      amount: 960000,
      currency: 'ETB',
      actor: 'Meron Alemu',
      occurredAt: '2026-08-16T10:05:00Z',
    },
    {
      id: 'act_0008',
      type: 'payment',
      reference: 'INV-0109',
      description: 'Payment recorded',
      amount: 15300000,
      currency: 'ETB',
      actor: 'Sara Girma',
      occurredAt: '2026-08-15T13:20:00Z',
    },
  ],
};

router.get(
  '/summary',
  requireAuth,
  requirePermission('dashboard.view'),
  async (req, res, next) => {
    try {
      // countDocuments rather than find().length — the counting happens in
      // Mongo and no documents cross the wire to be thrown away. Issued
      // together because neither depends on the other.
      const [activeCustomers, activeUsers] = await Promise.all([
        Customer.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'active' }),
      ]);

      // Spread so the static block above stays a constant: handing out the same
      // object every request would let one caller's mutation leak into the next.
      res.json({
        data: {
          ...summary,
          kpis: {
            ...summary.kpis,
            activeCustomers: { value: activeCustomers },
            activeUsers: { value: activeUsers },
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
