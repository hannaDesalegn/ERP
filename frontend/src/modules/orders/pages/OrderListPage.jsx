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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button, ConfirmDialog, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

import { deleteOrder, orderKeys, fetchOrders } from '../api';

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
  const queryClient = useQueryClient();

  // The row pending delete, or null. Holding the whole row (not just an id)
  // lets the confirm dialog show its order number without a second fetch.
  const [pendingDelete, setPendingDelete] = useState(null);

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

  const { data, isLoading, error } = useQuery({
    queryKey: orderKeys.list(queryParams),
    queryFn: () => fetchOrders(queryParams),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('Order deleted');
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error('Could not delete order', { description: err.message });
      setPendingDelete(null);
    },
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
            onClick: () => setPendingDelete(row),
          },
        ]}
        rowKey="id"
        stickyHeader
        density="comfortable"
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
        title="Delete order?"
        description={
          pendingDelete
            ? `This archives ${pendingDelete.orderNumber}. Linked invoices are unaffected.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}