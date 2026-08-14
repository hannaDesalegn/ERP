/**
 * Table state, synced to the URL — owned by A.
 *
 * Do not manage table state by hand. `/customers?page=2&status=active` must be
 * shareable, bookmarkable and survive a refresh, which means the state lives in
 * the query string, not in component state.
 *
 * See docs/api-contract.md §2 and docs/components.md § useTableParams.
 *
 *   const { page, perPage, sort, search, filters, queryParams, ... } =
 *     useTableParams({
 *       defaults: { perPage: 25, sort: '-createdAt' },
 *       filterKeys: ['status'],
 *     });
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * @param {{ defaults?: { perPage?: number, sort?: string }, filterKeys?: string[] }} [options]
 */
export function useTableParams(options = {}) {
  const { defaults = {}, filterKeys = [] } = options;
  const { perPage: defaultPerPage = 25, sort: defaultSort = '-createdAt' } =
    defaults;

  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || defaultPerPage;
  const sort = searchParams.get('sort') ?? defaultSort;
  const search = searchParams.get('search') ?? '';

  // Filters are repeatable: ?status=draft&status=sent → { status: ['draft','sent'] }
  const filters = useMemo(() => {
    const result = {};
    for (const key of filterKeys) {
      const values = searchParams.getAll(key);
      if (values.length > 0) result[key] = values;
    }
    return result;
    // searchParams is a new object each render; its string form is the real key.
  }, [searchParams, filterKeys]);

  /**
   * Merge updates into the query string. Empty/default values are removed so
   * the URL stays short and a shared link contains only what was actually set.
   */
  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(patch)) {
            next.delete(key);
            if (value === null || value === undefined || value === '') continue;
            if (Array.isArray(value)) {
              value.forEach((item) => next.append(key, String(item)));
            } else {
              next.set(key, String(value));
            }
          }

          // Any change to filtering or sizing invalidates the current page.
          if (resetPage) next.delete('page');

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (value) =>
      update({ page: value === 1 ? null : value }, { resetPage: false }),
    [update],
  );
  const setPerPage = useCallback(
    (value) => update({ perPage: value === defaultPerPage ? null : value }),
    [update, defaultPerPage],
  );
  const setSort = useCallback(
    (value) => update({ sort: value === defaultSort ? null : value }),
    [update, defaultSort],
  );
  const setSearch = useCallback((value) => update({ search: value }), [update]);
  const setFilters = useCallback((value) => update(value), [update]);

  /** Exactly what goes to the API, and what belongs in the query key. */
  const queryParams = useMemo(
    () => ({ page, perPage, sort, search: search || undefined, ...filters }),
    [page, perPage, sort, search, filters],
  );

  return {
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
  };
}
