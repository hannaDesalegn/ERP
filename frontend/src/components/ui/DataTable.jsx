import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };

// Responsive column dropping. Tailwind needs whole class names, so these are
// written out rather than built from a template string.
const HIDE_BELOW_CELL = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/** Read a cell value: the column's own renderer, or the raw field. */
function cellContent(column, row) {
  return column.render ? column.render(row) : row[column.key];
}

/**
 * The workhorse. Every list page in the app is this component.
 * Prop signature is locked — see docs/components.md § DataTable.
 *
 * Pagination and sorting are server-side: this component reports intent
 * through the callbacks and renders whatever `data` and `meta` come back.
 */
export function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  emptyState = null,

  // pagination — driven by meta from the API
  page = 1,
  perPage = 25,
  total = 0,
  onPageChange,
  onPerPageChange,

  // sorting — "-createdAt" means descending
  sort,
  onSortChange,

  // search + filters
  searchable = false,
  searchValue = '',
  onSearchChange,
  filters = null,

  // interaction
  onRowClick,
  rowActions,

  // bulk selection
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],

  // misc
  rowKey = 'id',
  stickyHeader = false,
  density = 'comfortable',
}) {
  const { can } = useAuth();
  const rowHeight = density === 'compact' ? 'h-row-compact' : 'h-row';

  const sortKey = sort?.startsWith('-') ? sort.slice(1) : sort;
  const sortDescending = Boolean(sort?.startsWith('-'));

  const toggleSort = (key) => {
    if (!onSortChange) return;
    // First click sorts ascending; clicking the active column flips direction.
    onSortChange(sortKey === key && !sortDescending ? `-${key}` : key);
  };

  const pageIds = data.map((row) => row[rowKey]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(
      allOnPageSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  const toggleRow = (id) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );
  };

  // rowActions carrying a `permission` the user lacks are hidden.
  // Hidden, not secured — docs/security-notes.md §2.
  const visibleActions = (row) =>
    (rowActions?.(row) ?? []).filter((action) => can(action.permission));

  const columnCount =
    columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        searchable={searchable}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        filters={filters}
        selectedCount={selectedIds.length}
        bulkActions={bulkActions}
      />

      {error ? (
        // Server `message` only — never a raw response body or stack trace.
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error.message ?? 'Could not load this list. Try again.'}
        </div>
      ) : (
        <>
          {/* Table for md and up. */}
          <div className="hidden overflow-x-auto rounded-md border border-border bg-surface md:block">
            <table className="w-full border-collapse text-sm">
              <thead
                className={cn(
                  'bg-bg text-text-muted',
                  stickyHeader && 'sticky top-0 z-10',
                )}
              >
                <tr>
                  {selectable && (
                    <th scope="col" className="w-10 px-2">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  )}

                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      style={{ width: column.width }}
                      aria-sort={
                        sortKey === column.key
                          ? sortDescending
                            ? 'descending'
                            : 'ascending'
                          : undefined
                      }
                      className={cn(
                        'px-3 py-2 text-xs font-semibold',
                        ALIGN[column.align ?? 'left'],
                        column.hideBelow && HIDE_BELOW_CELL[column.hideBelow],
                      )}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 rounded-sm hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {column.label}
                          <SortIcon
                            active={sortKey === column.key}
                            descending={sortDescending}
                          />
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}

                  {rowActions && <th scope="col" className="w-12 px-2" />}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <SkeletonRows
                    rows={Math.min(perPage, 8)}
                    columnCount={columnCount}
                    rowHeight={rowHeight}
                  />
                )}

                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="px-3 py-10">
                      {emptyState ?? (
                        <p className="text-center text-sm text-text-muted">
                          Nothing here yet.
                        </p>
                      )}
                    </td>
                  </tr>
                )}

                {!loading &&
                  data.map((row) => {
                    const id = row[rowKey];
                    const actions = visibleActions(row);

                    return (
                      <tr
                        key={id}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        onKeyDown={
                          onRowClick
                            ? (event) => {
                                if (
                                  event.key === 'Enter' ||
                                  event.key === ' '
                                ) {
                                  event.preventDefault();
                                  onRowClick(row);
                                }
                              }
                            : undefined
                        }
                        tabIndex={onRowClick ? 0 : undefined}
                        className={cn(
                          'border-t border-border',
                          rowHeight,
                          onRowClick &&
                            'cursor-pointer hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                          selectedIds.includes(id) && 'bg-bg',
                        )}
                      >
                        {selectable && (
                          <td
                            className="px-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(id)}
                              onChange={() => toggleRow(id)}
                              aria-label={`Select row ${id}`}
                            />
                          </td>
                        )}

                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={cn(
                              'px-3 py-1.5',
                              ALIGN[column.align ?? 'left'],
                              column.hideBelow &&
                                HIDE_BELOW_CELL[column.hideBelow],
                            )}
                          >
                            {cellContent(column, row)}
                          </td>
                        ))}

                        {rowActions && (
                          <td
                            className="px-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {actions.length > 0 && (
                              <RowActionsMenu actions={actions} />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Below 768px the table becomes stacked cards. */}
          <MobileCards
            columns={columns}
            data={data}
            loading={loading}
            emptyState={emptyState}
            rowKey={rowKey}
            onRowClick={onRowClick}
            visibleActions={rowActions ? visibleActions : null}
          />
        </>
      )}

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
      />
    </div>
  );
}

function SortIcon({ active, descending }) {
  if (!active) return <ArrowUpDown size={12} aria-hidden="true" />;
  return descending ? (
    <ArrowDown size={12} aria-hidden="true" />
  ) : (
    <ArrowUp size={12} aria-hidden="true" />
  );
}

function Toolbar({
  searchable,
  searchValue,
  onSearchChange,
  filters,
  selectedCount,
  bulkActions,
}) {
  if (!searchable && !filters && selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchable && (
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className="h-9 w-56 rounded-md border border-border bg-surface px-2.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}

      {filters}

      {selectedCount > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-text-muted">
            {selectedCount} selected
          </span>
          {bulkActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRows({ rows, columnCount, rowHeight }) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index} className={cn('border-t border-border', rowHeight)}>
      {Array.from({ length: columnCount }, (_, cell) => (
        <td key={cell} className="px-3 py-1.5">
          <div className="h-3 w-full animate-pulse rounded-sm bg-bg" />
        </td>
      ))}
    </tr>
  ));
}

function RowActionsMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        className="rounded-sm p-1 text-text-muted hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg focus-visible:bg-bg focus-visible:outline-none',
                  action.destructive ? 'text-danger' : 'text-text',
                )}
              >
                {Icon && <Icon size={14} />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Stacked-card rendering for narrow screens. */
function MobileCards({
  columns,
  data,
  loading,
  emptyState,
  rowKey,
  onRowClick,
  visibleActions,
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-md border border-border bg-surface"
          />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-10 md:hidden">
        {emptyState ?? (
          <p className="text-center text-sm text-text-muted">
            Nothing here yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {data.map((row) => {
        const id = row[rowKey];
        const actions = visibleActions?.(row) ?? [];

        return (
          <li
            key={id}
            className="rounded-md border border-border bg-surface p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <dl className="flex min-w-0 flex-1 flex-col gap-1">
                {columns.map((column) => (
                  <div key={column.key} className="flex gap-2 text-sm">
                    <dt className="w-28 shrink-0 text-text-muted">
                      {column.label}
                    </dt>
                    <dd className="min-w-0 flex-1 text-text">
                      {cellContent(column, row)}
                    </dd>
                  </div>
                ))}
              </dl>
              {actions.length > 0 && <RowActionsMenu actions={actions} />}
            </div>

            {onRowClick && (
              <button
                type="button"
                onClick={() => onRowClick(row)}
                className="mt-2 rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Open
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Pagination({ page, perPage, total, onPageChange, onPerPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
      <span>
        {first}–{last} of {total}
      </span>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="sr-only">Rows per page</span>
          <select
            value={perPage}
            onChange={(event) => onPerPageChange?.(Number(event.target.value))}
            className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-md border border-border bg-surface p-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="text-text">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="rounded-md border border-border bg-surface p-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
