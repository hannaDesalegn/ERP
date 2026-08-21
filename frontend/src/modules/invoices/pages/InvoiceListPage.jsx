/**
 * Invoice list — B owns this file.
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

import { deleteInvoice, invoiceKeys, fetchInvoices } from '../api';

const columns = [
  {
    key: 'invoiceNumber',
    label: 'Invoice #',
    sortable: true,
    width: '140px',
    render: (row) => <span className="font-mono text-xs">{row.invoiceNumber}</span>,
  },
  { key: 'customerName', label: 'Customer', sortable: true },
  { key: 'dueDate', label: 'Due Date', sortable: true, hideBelow: 'lg' },
  {
    key: 'amountDue',
    label: 'Amount Due',
    sortable: true,
    align: 'right',
    // amountDue is server-derived (grandTotal - amountPaid) — display only,
    // never computed here.
    render: (row) => formatMoney(row.amountDue, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    // 'overdue' comes straight from the server; the UI never calculates it.
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function InvoiceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The row pending delete, or null. Holding the whole row (not just an id)
  // lets the confirm dialog show its invoice number without a second fetch.
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
    queryKey: invoiceKeys.list(queryParams),
    queryFn: () => fetchInvoices(queryParams),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success('Invoice deleted');
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error('Could not delete invoice', { description: err.message });
      setPendingDelete(null);
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Invoices"
        description="Bills sent to customers, and what's still owed."
        actions={
          <Button icon={Plus} onClick={() => navigate('/invoices/new')}>
            Add invoice
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
        onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'invoices.edit',
            onClick: () => navigate(`/invoices/${row.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash,
            permission: 'invoices.delete',
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
        title="Delete invoice?"
        description={pendingDelete ? `This archives ${pendingDelete.invoiceNumber}.` : ''}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}