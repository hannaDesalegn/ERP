/**
 * Dashboard — owned by A. The landing page for every signed-in user.
 *
 * Four KPI cards and a recent-activity table, from one request. Kit components
 * only: PageHeader, KPICard, DataTable.
 *
 * The four metrics are the ones where a rise is good news. KPICard colours its
 * trend from `direction` alone — it has no notion of whether up is good for a
 * given metric — so outstanding balance and overdue invoices stay off this page
 * until that is settled. Adding them now would paint a growing debt green.
 */

import { useQuery } from '@tanstack/react-query';
import { Banknote, Receipt, ShoppingCart, Users } from 'lucide-react';

import { DataTable, KPICard, PageHeader } from '@/components/ui';
import { apiClient } from '@/lib/apiClient';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';

/**
 * Foundation pages are not modules, so there is no api.js for this to live in.
 * One endpoint does not justify a folder; if the foundation grows a second one,
 * both move into src/pages/api.js together.
 */
const dashboardKeys = { summary: ['dashboard', 'summary'] };

async function fetchDashboardSummary() {
  const { data } = await apiClient.get('/dashboard/summary');
  return data;
}

/**
 * Recent activity is a fixed feed, not a collection: the endpoint takes no
 * page/sort/search params, so no column is sortable and nothing is wired to
 * useTableParams. Sorting a column here would silently sort one page of a
 * server-decided slice, which is the exact bug the list pages warn about.
 */
const columns = [
  {
    key: 'occurredAt',
    label: 'When',
    width: '160px',
    render: (row) => formatDateTime(row.occurredAt),
  },
  {
    key: 'reference',
    label: 'Reference',
    width: '120px',
    // Mono for codes and document numbers, as on every other table.
    render: (row) => <span className="font-mono text-xs">{row.reference}</span>,
  },
  { key: 'description', label: 'Activity' },
  { key: 'actor', label: 'By', hideBelow: 'lg' },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    // null amount → formatMoney returns an em dash. Not every event has money.
    render: (row) => formatMoney(row.amount, row.currency),
  },
];

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: fetchDashboardSummary,
  });

  const kpis = data?.kpis;

  /**
   * Plain data, like a column list. `value` is pre-formatted because that is
   * what KPICard takes — the card renders a string and does no maths on it.
   * On error every value falls back to an em dash and the table below carries
   * the one error message, rather than four cards each shouting the same thing.
   */
  const cards = [
    {
      key: 'revenue',
      title: 'Revenue this month',
      icon: Banknote,
      value: formatMoney(
        kpis?.revenueThisMonth.value,
        kpis?.revenueThisMonth.currency,
      ),
      trend: kpis?.revenueThisMonth.trend,
    },
    {
      key: 'orders',
      title: 'Orders this month',
      icon: ShoppingCart,
      value: formatNumber(kpis?.ordersThisMonth.value),
      trend: kpis?.ordersThisMonth.trend,
    },
    {
      key: 'customers',
      title: 'Active customers',
      icon: Users,
      value: formatNumber(kpis?.activeCustomers.value),
      trend: kpis?.activeCustomers.trend,
    },
    {
      key: 'aov',
      title: 'Average order value',
      icon: Receipt,
      value: formatMoney(
        kpis?.averageOrderValue.value,
        kpis?.averageOrderValue.currency,
      ),
      trend: kpis?.averageOrderValue.trend,
    },
  ];

  const activity = data?.recentActivity ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      {/* No breadcrumbs prop — the shell's topbar derives the trail from the
          URL, so passing them here would render two of them. */}
      <PageHeader
        title="Dashboard"
        description="Where the business stands today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <KPICard
            key={card.key}
            title={card.title}
            value={card.value}
            icon={card.icon}
            trend={card.trend}
            // The card's own loading state — it renders Skeleton variant="card"
            // internally. A second pulse implementation here would drift.
            loading={isLoading}
          />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text">Recent activity</h2>

        {/* Pagination props are static: this feed is one short server-decided
            slice, so the footer reads "1–8 of 8" and both arrows stay disabled
            rather than offering a page 2 that does not exist. */}
        <DataTable
          columns={columns}
          data={activity}
          loading={isLoading}
          error={error}
          page={1}
          perPage={10}
          total={activity.length}
          rowKey="id"
          density="compact"
        />
      </section>
    </div>
  );
}
