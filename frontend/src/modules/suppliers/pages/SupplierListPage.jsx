/**
 * Supplier list — C owns this file.
 *
 * Same four-step shape as every list page in the app:
 *   1. useTableParams()  2. useQuery()  3. columns  4. <DataTable />
 *
 * No sorting, filtering or pagination in the browser — the server does all
 * three (docs/api-contract.md §2).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  StatusBadge,
  toast,
} from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

import { deleteSupplier, fetchSuppliers, supplierKeys } from '../api';

const columns = [
  {
    key: 'code',
    label: 'Code',
    sortable: true,
    width: '110px',
    // Codes render mono — scannable in a dense table.
    render: (row) => <span className="font-mono text-xs">{row.code}</span>,
  },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'contactPerson', label: 'Contact', hideBelow: 'lg' },
  { key: 'email', label: 'Email', hideBelow: 'xl' },
  {
    key: 'balance',
    label: 'We owe',
    sortable: true,
    align: 'right',
    // Money is an integer in minor units; formatMoney is the only thing that
    // turns it into something a human reads.
    render: (row) => formatMoney(row.balance, row.currency),
  },
  {
    key: 'paymentTermsDays',
    label: 'Terms',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => `${row.paymentTermsDays} days`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function SupplierListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);

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
    defaults: { perPage: 25, sort: 'code' },
    filterKeys: ['status'],
  });

  // 2. Server state, keyed on those params.
  const { data, isLoading, error } = useQuery({
    queryKey: supplierKeys.list(queryParams),
    queryFn: () => fetchSuppliers(queryParams),
    placeholderData: (previous) => previous,
  });

  const removal = useMutation({
    mutationFn: (id) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
      toast.success('Supplier deleted');
      setPendingDelete(null);
    },
    onError: (deleteError) => {
      // 409 here means open purchase orders still reference this supplier.
      toast.error('Could not delete supplier', {
        description: deleteError.message,
      });
      setPendingDelete(null);
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Suppliers"
        description="Everyone you buy from."
        actions={
          <Button icon={Plus} onClick={() => navigate('/suppliers/new')}>
            Add supplier
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
            <p className="text-sm font-medium text-text">No suppliers yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Suppliers you add will appear here.
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        }
        onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
        // Actions carrying a permission the user lacks are hidden. Hidden, not
        // secured — docs/security-notes.md §2.
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'suppliers.edit',
            onClick: () => navigate(`/suppliers/${row.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash,
            permission: 'suppliers.delete',
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
        onConfirm={() => removal.mutate(pendingDelete.id)}
        title="Delete supplier?"
        description={
          pendingDelete
            ? `This archives ${pendingDelete.code} — ${pendingDelete.name}. Existing purchase orders are unaffected.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={removal.isPending}
      />
    </div>
  );
}
