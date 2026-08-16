/**
 * Product list — C owns this file.
 *
 * Follows the four-step shape every list page in this app uses:
 *   1. useTableParams()  — table state, synced to the URL
 *   2. useQuery()        — server state, keyed on those params
 *   3. columns           — plain data, defined outside the JSX
 *   4. <DataTable />     — wired to both
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

import { ProductStockBadge } from '../components/ProductStockBadge';
import {
  deleteProduct,
  fetchProductCategories,
  fetchProducts,
  productKeys,
} from '../api';

const columns = [
  {
    key: 'sku',
    label: 'SKU',
    sortable: true,
    width: '110px',
    // SKUs render mono — it makes them scannable in a dense table.
    // docs/components.md § Design tokens.
    render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
  },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'categoryName', label: 'Category', hideBelow: 'lg' },
  {
    key: 'sellingPrice',
    label: 'Selling price',
    sortable: true,
    align: 'right',
    // Money is an integer in minor units; formatMoney is the only thing that
    // turns it into something a human reads.
    render: (row) => formatMoney(row.sellingPrice, row.currency),
  },
  {
    key: 'costPrice',
    label: 'Cost',
    sortable: true,
    align: 'right',
    hideBelow: 'xl',
    render: (row) => formatMoney(row.costPrice, row.currency),
  },
  {
    key: 'quantityAvailable',
    label: 'Available',
    sortable: true,
    align: 'right',
    render: (row) => (
      <ProductStockBadge
        quantityAvailable={row.quantityAvailable}
        reorderLevel={row.reorderLevel}
        unitOfMeasure={row.unitOfMeasure}
      />
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
];

export function ProductListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);

  // 1. Table state lives in the URL, so /products?page=2&status=active is
  //    shareable and survives a refresh.
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
    defaults: { perPage: 25, sort: 'sku' },
    // categoryId and lowStock are module-specific filters, which
    // docs/api-contract.md §2 allows and this module owns.
    filterKeys: ['status', 'categoryId', 'lowStock'],
  });

  // 2. Server state, keyed on those params.
  const { data, isLoading, error } = useQuery({
    queryKey: productKeys.list(queryParams),
    queryFn: () => fetchProducts(queryParams),
    // Keeps the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
  });

  // Categories drive the filter select. Cached separately — it changes rarely.
  const { data: categories = [] } = useQuery({
    queryKey: productKeys.categories(),
    queryFn: fetchProductCategories,
    staleTime: 5 * 60 * 1000,
  });

  const removal = useMutation({
    mutationFn: (id) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      toast.success('Product deleted');
      setPendingDelete(null);
    },
    onError: (deleteError) => {
      toast.error('Could not delete product', {
        description: deleteError.message,
      });
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      {/* No `breadcrumbs` prop — the shell's topbar derives the trail from the
          URL, so passing them here would render two of them. */}
      <PageHeader
        title="Products"
        description="Everything you buy, hold and sell."
        actions={
          <Button icon={Plus} onClick={() => navigate('/products/new')}>
            Add product
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
            <p className="text-sm font-medium text-text">No products yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Products you add will appear here.
            </p>
          </div>
        }
        // Pagination is server-side: meta comes from the API, never rows.length.
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
          <ProductFilters
            categories={categories}
            filters={filters}
            onChange={setFilters}
          />
        }
        onRowClick={(row) => navigate(`/products/${row.id}`)}
        // Actions carrying a permission the user lacks are hidden. Hidden, not
        // secured — the server must reject the request too.
        // docs/security-notes.md §2.
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'products.edit',
            onClick: () => navigate(`/products/${row.id}/edit`),
          },
          {
            label: 'Delete',
            icon: Trash,
            permission: 'products.delete',
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
        title="Delete product?"
        description={
          pendingDelete
            ? `This archives ${pendingDelete.sku} — ${pendingDelete.name}. Existing orders and stock history are unaffected.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={removal.isPending}
      />
    </div>
  );
}

/**
 * Toolbar filters. Rendered into DataTable's `filters` slot, which is a plain
 * node — the table does not care what is in it.
 */
function ProductFilters({ categories, filters, onChange }) {
  const selectClasses =
    'h-9 rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  // useTableParams stores filters as arrays (?status=a&status=b), so a single
  // select reads index 0 and writes either [value] or null to clear.
  const single = (key) => filters[key]?.[0] ?? '';

  return (
    <>
      <label className="flex items-center gap-1">
        <span className="sr-only">Filter by status</span>
        <select
          value={single('status')}
          onChange={(event) =>
            onChange({ status: event.target.value || null })
          }
          className={selectClasses}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="sr-only">Filter by category</span>
        <select
          value={single('categoryId')}
          onChange={(event) =>
            onChange({ categoryId: event.target.value || null })
          }
          className={selectClasses}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-text">
        <input
          type="checkbox"
          checked={single('lowStock') === 'true'}
          onChange={(event) =>
            onChange({ lowStock: event.target.checked ? 'true' : null })
          }
        />
        Low stock only
      </label>
    </>
  );
}
