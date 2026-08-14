/**
 * Customer list — B owns this file.
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

import { customerKeys, fetchCustomers } from '../api';

/**
 * Columns are plain data, so they stay out of the render path and can be
 * unit-tested. `render` is only for cells that need formatting or a component.
 */
const columns = [
  {
    key: 'code',
    label: 'Code',
    sortable: true,
    width: '110px',
    // Codes, SKUs and order numbers render mono — it makes them scannable in a
    // dense table. docs/components.md § Design tokens.
    render: (row) => <span className="font-mono text-xs">{row.code}</span>,
  },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', hideBelow: 'lg' },
  { key: 'phone', label: 'Phone', hideBelow: 'xl' },
  {
    key: 'balance',
    label: 'Balance',
    sortable: true,
    align: 'right',
    // Money is an integer in minor units. formatMoney is the only thing that
    // turns it into something a human reads — never do arithmetic on the string.
    render: (row) => formatMoney(row.balance, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function CustomerListPage() {
  const navigate = useNavigate();

  // 1. Table state lives in the URL, so /customers?page=2&status=active is
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
    queryKey: customerKeys.list(queryParams),
    queryFn: () => fetchCustomers(queryParams),
    // Keeps the previous page on screen while the next one loads, instead of
    // flashing an empty table on every page change.
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      {/* No `breadcrumbs` prop — the shell's topbar derives the trail from the
          URL, so passing them here would render two of them. PageHeader still
          accepts the prop for any page rendered outside the shell. */}
      <PageHeader
        title="Customers"
        description="Everyone you invoice."
        actions={
          <Button icon={Plus} onClick={() => navigate('/customers/new')}>
            Add customer
          </Button>
        }
      />

      {/* 4. One component, driven by 1 and 2. */}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error}
        // Pagination is server-side: meta comes from the API, never from
        // rows.length.
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
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
        // Actions carrying a permission the user lacks are hidden. Hidden, not
        // secured — the server must reject the request too.
        // docs/security-notes.md §2.
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'customers.edit',
            onClick: () => navigate(`/customers/${row.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash,
            permission: 'customers.delete',
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
