import { Router } from 'express';

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
 *   activeUsers          User.countDocuments({ status: 'active' })
 *
 * STATIC — the collection behind it does not exist yet:
 *
 *   revenueThisMonth     Invoices / payments
 *   ordersThisMonth      Orders
 *   activeCustomers      Customers — see below
 *   averageOrderValue    derived from the two order figures
 *   outstandingBalance   Invoices
 *   overdueInvoices      Invoices
 *   recentActivity       order / invoice / payment / customer events
 *
 * activeCustomers is deliberately NOT wired to the user count. Customer is a
 * separate entity from User (entities.md) and DashboardPage renders this card
 * under the title "Active customers" — feeding it a count of staff accounts
 * would put a real number beneath a label that means something else, which is
 * worse than an obviously unbuilt one. The genuine count is exposed under its
 * own activeUsers key instead. The page reads six KPIs by name rather than
 * iterating, so the extra key renders nothing until someone adds a card for it.
 *
 * Every `trend` is static, and stays that way even once the models land — a
 * month-over-month comparison needs history to compare against, which a
 * current-state count cannot produce on its own. activeUsers therefore carries
 * no trend at all rather than a made-up one.
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
    activeCustomers: {
      value: 21,
      trend: { value: 4.8, direction: 'up', label: 'vs last month' },
    },
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
      // countDocuments rather than find().length — the count happens in Mongo
      // and no documents cross the wire to be thrown away.
      const activeUsers = await User.countDocuments({ status: 'active' });

      // Spread so the static block above stays a constant: handing out the same
      // object every request would let one caller's mutation leak into the next.
      res.json({
        data: {
          ...summary,
          kpis: { ...summary.kpis, activeUsers: { value: activeUsers } },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
