/**
 * Product detail — C owns this file.
 *
 * The "Adjust stock" action is here rather than an editable quantity field on
 * the form, because stock only ever changes through an adjustment record
 * (docs/entities.md § Product). The movement history below is the audit trail
 * that requirement exists to produce.
 */

import { useQuery } from '@tanstack/react-query';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import { Can } from '@/lib/auth';
import {
  formatDateTime,
  formatEnum,
  formatMoney,
  formatNumber,
} from '@/lib/format';

import { ProductAdjustStockDialog } from '../components/ProductAdjustStockDialog';
import { ProductStockBadge } from '../components/ProductStockBadge';
import { fetchProduct, fetchProductAdjustments, productKeys } from '../api';

/** Movement history columns. Read-only — an adjustment is never edited. */
const adjustmentColumns = [
  {
    key: 'createdAt',
    label: 'When',
    width: '170px',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'direction',
    label: 'Direction',
    width: '110px',
    render: (row) => (
      <span
        className={
          row.direction === 'increase'
            ? 'text-sm text-success'
            : 'text-sm text-danger'
        }
      >
        {row.direction === 'increase' ? '+' : '−'} {formatNumber(row.quantity)}
      </span>
    ),
  },
  {
    key: 'reason',
    label: 'Reason',
    render: (row) => formatEnum(row.reason),
  },
  {
    key: 'reference',
    label: 'Reference',
    hideBelow: 'md',
    render: (row) =>
      row.reference ? (
        <span className="font-mono text-xs">{row.reference}</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'notes',
    label: 'Notes',
    hideBelow: 'lg',
    render: (row) => row.notes ?? '—',
  },
];

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adjusting, setAdjusting] = useState(false);

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchProduct(id),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: productKeys.adjustments(id),
    queryFn: () => fetchProductAdjustments(id),
    // No point asking for movements of a product that failed to load.
    enabled: Boolean(product),
  });

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        {/* Server `message` only — never a raw body or stack trace. */}
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface" />
        <div className="h-48 animate-pulse rounded-md border border-border bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.categoryName}`}
        actions={
          <>
            {/* Hidden when the user lacks the right. Hidden, not secured —
                docs/security-notes.md §2. */}
            <Can permission="products.adjust_stock">
              <Button
                variant="secondary"
                icon={SlidersHorizontal}
                onClick={() => setAdjusting(true)}
              >
                Adjust stock
              </Button>
            </Can>
            <Can permission="products.edit">
              <Button
                icon={Pencil}
                onClick={() => navigate(`/products/${product.id}/edit`)}
              >
                Edit
              </Button>
            </Can>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Stock">
          <Field label="On hand">
            {formatNumber(product.quantityOnHand, {
              unit: product.unitOfMeasure,
            })}
          </Field>
          <Field label="Reserved" hint="Committed to approved orders.">
            {formatNumber(product.quantityReserved, {
              unit: product.unitOfMeasure,
            })}
          </Field>
          <Field label="Available" hint="On hand minus reserved.">
            <ProductStockBadge
              quantityAvailable={product.quantityAvailable}
              reorderLevel={product.reorderLevel}
              unitOfMeasure={product.unitOfMeasure}
            />
          </Field>
          <Field label="Reorder level">
            {formatNumber(product.reorderLevel, {
              unit: product.unitOfMeasure,
            })}
          </Field>
        </Card>

        <Card title="Pricing">
          <Field label="Cost price">
            {formatMoney(product.costPrice, product.currency)}
          </Field>
          <Field label="Selling price">
            {formatMoney(product.sellingPrice, product.currency)}
          </Field>
          <Field label="Currency">{product.currency}</Field>
          <Field label="Status">
            <StatusBadge status={product.status} variant="auto" />
          </Field>
        </Card>

        <Card title="Details">
          <Field label="SKU">
            <span className="font-mono text-xs">{product.sku}</span>
          </Field>
          <Field label="Barcode">
            {product.barcode ? (
              <span className="font-mono text-xs">{product.barcode}</span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Unit of measure">{product.unitOfMeasure}</Field>
          <Field label="Description">{product.description ?? '—'}</Field>
        </Card>

        <Card title="Record">
          <Field label="Created">{formatDateTime(product.createdAt)}</Field>
          <Field label="Last updated">
            {formatDateTime(product.updatedAt)}
          </Field>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">Stock movements</h2>
        <DataTable
          columns={adjustmentColumns}
          data={history?.data ?? []}
          loading={historyLoading}
          emptyState={
            <div className="text-center">
              <p className="text-sm font-medium text-text">
                No stock movements yet
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Every increase and decrease will be listed here.
              </p>
            </div>
          }
          page={history?.meta?.page ?? 1}
          perPage={history?.meta?.perPage ?? 25}
          total={history?.meta?.total ?? 0}
          rowKey="id"
          density="compact"
        />
      </section>

      <ProductAdjustStockDialog
        open={adjusting}
        onClose={() => setAdjusting(false)}
        product={product}
      />
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-32 shrink-0 text-text-muted">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd className="min-w-0 flex-1 text-text">{children}</dd>
    </div>
  );
}
