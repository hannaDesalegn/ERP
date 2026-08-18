/**
 * Dashboard handlers + summary data — owned by A.
 *
 * One endpoint: GET /api/dashboard/summary (docs/api-contract.md §4, A —
 * Foundation). It answers a single resource, so the envelope is `{ data }` with
 * no `meta` — recentActivity is a field inside that object rather than a bare
 * array at the top level.
 *
 * Money is an integer in minor units here exactly like everywhere else:
 * 486250000 is 4,862,500.00 ETB. Nothing in this file is a pre-formatted
 * string — formatting is the page's job, and a formatted number on the wire is
 * a number you can no longer do arithmetic on.
 *
 * Every record is invented. docs/security-notes.md § Fake data only.
 */

import { http, HttpResponse } from 'msw';

import { delay, serverError } from './helpers';

const BASE = '/api/dashboard';

/**
 * The four cards, each carrying its trend in the shape KPICard takes: a
 * magnitude, a direction, and the comparison spelled out in the label.
 *
 * All four are metrics where a rise is good news, which is the only reason
 * KPICard's direction-decides-the-colour behaviour is right for them.
 * Outstanding balance and overdue invoices are deliberately not here: up is bad
 * news for both, and the card would paint the rise green. That gap is open —
 * see the KPICard commit — and picking these four sidesteps it rather than
 * pretending it is closed.
 */
const summary = {
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
  },

  /**
   * A short, fixed feed — not a paginated collection, which is why it has no
   * `meta` of its own and takes no query parameters. `amount` is null where the
   * event has no money attached; the page renders that as an em dash.
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

export const dashboardHandlers = [
  /**
   * Always 500 — point the page at this to see its error state. Declared first
   * out of habit with the module handlers; both paths here are literal, so
   * nothing can swallow anything, but the ordering rule stays visible.
   */
  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load the dashboard. Try again.');
  }),

  /** GET /api/dashboard/summary — KPI cards + recent activity. */
  http.get(`${BASE}/summary`, async () => {
    await delay();
    return HttpResponse.json({ data: summary });
  }),
];
