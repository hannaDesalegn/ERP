/**
 * Purchase order list — C owns this file.
 *
 * Same four-step shape as every list page in the app:
 *   1. useTableParams()  2. useQuery()  3. columns  4. <DataTable />
 *
 * No sorting, filtering or pagination in the browser — the server does all
 * three (docs/api-contract.md §2).
 */

import { useQuery } from '@tanstack/react-query';
import { Eye, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  DataTable,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

import { fetchPurchaseOrders, purchaseOrderKeys } from '../api';

const columns = [
  {
    key: 'poNumber',
    label: 'PO number',
    sortable: true,
    width: '150px',
    // Order numbers render mono — it makes PO-2026-0031 scannable in a dense
    // table. docs/components.md § Design tokens.
    render: (row) => <span className="font-mono text-xs">{row.poNumber}</span>,
  },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'orderDate',
    label: 'Ordered',
    sortable: true,
    hideBelow: 'md',
    render: (row) => formatDate(row.orderDate),
  },
  {
    key: 'expectedDate',
    label: 'Expected',
    sortable: true,
    hideBelow: 'xl',
    render: (row) => formatDate(row.expectedDate),
  },
  {
    key: 'grandTotal',
    label: 'Total',
    sortable: true,
    align: 'right',
    // Money is an integer in minor units; formatMoney is the only thing that
    // turns it into something a human reads.
    render: (row) => formatMoney(row.grandTotal, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

const STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'partially_received',
  'received',
  'cancelled',
];

export function PurchaseOrderListPage() {
  const navigate = useNavigate();

  // 1. Table state lives in the URL, so the page is shareable and refresh-safe.
  const {
    page,
    perPage,
    sort,
    search,
    filters,
    setPage,
    setPerPage,
    setSort,
    setSearch,
    setFilters,
    queryParams,
  } = useTableParams({
    defaults: { perPage: 25, sort: '-orderDate' },
    filterKeys: ['status', 'supplierId'],
  });

  // 2. Server state, keyed on those params.
  const { data, isLoading, error } = useQuery({
    queryKey: purchaseOrderKeys.list(queryParams),
    queryFn: () => fetchPurchaseOrders(queryParams),
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Purchase orders"
        description="What you have ordered, and what has arrived."
        actions={
          <Button icon={Plus} onClick={() => navigate('/purchase-orders/new')}>
            New purchase order
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error}
        emptyState={
          <div className="text-center">
            <p className="text-sm font-medium text-text">
              No purchase orders yet
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Orders you raise will appear here.
            </p>
          </div>
        }
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
        filters={
          <label className="flex items-center gap-1">
            <span className="sr-only">Filter by status</span>
            <select
              value={filters.status?.[0] ?? ''}
              onChange={(event) =>
                setFilters({ status: event.target.value || null })
              }
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
        }
        onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
        // Editing, approving and receiving all live on the detail page, because
        // each has its own rules about which status it is legal from. A row
        // menu that offered them would have to duplicate that logic.
        rowActions={(row) => [
          {
            label: 'Open',
            icon: Eye,
            permission: 'purchasing.view',
            onClick: () => navigate(`/purchase-orders/${row.id}`),
          },
        ]}
        rowKey="id"
        stickyHeader
        density="comfortable"
      />
    </div>
  );
}
