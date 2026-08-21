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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button, ConfirmDialog, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

import { customerKeys, deleteCustomer, fetchCustomers } from '../api';

const columns = [
  {
    key: 'code',
    label: 'Code',
    sortable: true,
    width: '110px',
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
  const queryClient = useQueryClient();

  // The row pending delete, or null. Holding the whole row (not just an id)
  // lets the confirm dialog show its name without a second fetch.
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
    queryKey: customerKeys.list(queryParams),
    queryFn: () => fetchCustomers(queryParams),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Customer deleted');
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error('Could not delete customer', { description: err.message });
      setPendingDelete(null);
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Customers"
        description="Everyone you invoice."
        actions={
          <Button icon={Plus} onClick={() => navigate('/customers/new')}>
            Add customer
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
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
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
        title="Delete customer?"
        description={
          pendingDelete
            ? `This archives ${pendingDelete.name}. Existing orders are unaffected.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}