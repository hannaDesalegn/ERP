/**
 * Order list — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the columns, the nouns, the filter keys, the empty-state copy.
 * KEEP:   the four-step shape below. Every list page in this app is these four
 *         steps in this order, which is what makes them reviewable at a glance.
 *
 *   1. useTableParams()  — table state, synced to the URL
 *   2. useQuery()        — server state, keyed on those params
 *   3. columns           — plain data, defined outside the JSX
 *   4. <DataTable />     — wired to both
 *
 * DO NOT: sort, filter or paginate in the browser. The server does all three
 * (docs/api-contract.md §2). If you slice an array here, page 2 will be wrong
 * the moment the dataset outgrows one page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

import { orderKeys, fetchOrders } from '../api';

const columns = [
  {
    key: 'orderNumber',
    label: 'Order #',
    sortable: true,
    width: '140px',
    render: (row) => <span className="font-mono text-xs">{row.orderNumber}</span>,
  },
  { key: 'customerName', label: 'Customer', sortable: true },
  { key: 'orderDate', label: 'Order Date', sortable: true, hideBelow: 'lg' },
  {
    key: 'grandTotal',
    label: 'Total',
    sortable: true,
    align: 'right',
    render: (row) => formatMoney(row.grandTotal, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function OrderListPage() {
  const navigate = useNavigate();

  // 1. Table state lives in the URL, so /orders?page=2&status=approved is
  //    shareable and survives a refresh.
  const {
    page,
    perPage,
    sort,
    search,
    setPage,
    setPerPage,
    setSort,
    setSearch,
    queryParams,
  } = useTableParams({
    defaults: { perPage: 25, sort: '-createdAt' },
    filterKeys: ['status'],
  });

  // 2. Server state. The key includes queryParams, so changing a filter is a
  //    new cache entry rather than a refetch that clobbers the old one.
  const { data, isLoading, error } = useQuery({
    queryKey: orderKeys.list(queryParams),
    queryFn: () => fetchOrders(queryParams),
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Orders"
        description="Sales orders placed by customers."
        actions={
          <Button icon={Plus} onClick={() => navigate('/orders/new')}>
            Add order
          </Button>
        }
      />

      {/* 4. One component, driven by 1 and 2. */}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error}
        page={meta.page}
        perPage={meta.perPage}
        total={meta.total}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        sort={sort}
        onSortChange={setSort}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'orders.edit',
            onClick: () => navigate(`/orders/${row.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash,
            permission: 'orders.delete',
            destructive: true,
            // TODO(B): ConfirmDialog + useMutation once the kit ships one.
            onClick: () => {},
          },
        ]}
        rowKey="id"
        stickyHeader
        density="comfortable"
      />
    </div>
  );
}