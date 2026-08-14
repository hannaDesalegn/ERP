/**
 * Shared mock helpers — owned by A, used by every module's handlers.
 *
 * These exist so all three modules paginate, delay and fail identically. If a
 * module hand-rolls its own pagination, the UI starts behaving differently per
 * screen and the real backend swap gets harder. Call these instead.
 *
 * See docs/api-contract.md §5.
 */

import { HttpResponse } from 'msw';

/** Server caps perPage regardless of what the client asks for. */
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 25;

/**
 * Realistic latency, so loading states and skeletons actually get exercised
 * during development instead of flashing past.
 *
 * @param {number} [ms]
 * @returns {Promise<void>}
 */
export function delay(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply the standard collection query parameters and wrap the result in the
 * `{ data, meta }` envelope.
 *
 * Handles `page`, `perPage`, `search`, `sort`, and any repeatable filter keys.
 * Every list endpoint in the app accepts the same set — that consistency is
 * what lets one DataTable drive every module.
 *
 *   paginate(customers, url)
 *   paginate(customers, url, { searchFields: ['code', 'name', 'email'] })
 *
 * @param {object[]} records the module's full mock array
 * @param {URL} url the request URL, for reading query params
 * @param {{ searchFields?: string[], filterKeys?: string[] }} [options]
 * @returns {{ data: object[], meta: { page: number, perPage: number, total: number, totalPages: number } }}
 */
export function paginate(records, url, options = {}) {
  const { searchFields, filterKeys = ['status'] } = options;
  const params = url.searchParams;

  let rows = [...records];

  // --- search: free text, server decides which fields ---
  const search = params.get('search')?.trim().toLowerCase();
  if (search) {
    // Default to every top-level string field, so a module gets sensible
    // search without configuring anything.
    const fields =
      searchFields ??
      Object.keys(rows[0] ?? {}).filter(
        (key) => typeof rows[0][key] === 'string',
      );

    rows = rows.filter((row) =>
      fields.some((field) =>
        String(row[field] ?? '')
          .toLowerCase()
          .includes(search),
      ),
    );
  }

  // --- filters: repeatable, e.g. ?status=draft&status=sent ---
  for (const key of filterKeys) {
    const values = params.getAll(key);
    if (values.length > 0) {
      rows = rows.filter((row) => values.includes(String(row[key])));
    }
  }

  // --- date range: inclusive, YYYY-MM-DD, against createdAt ---
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  if (dateFrom) {
    rows = rows.filter((row) => row.createdAt?.slice(0, 10) >= dateFrom);
  }
  if (dateTo) {
    rows = rows.filter((row) => row.createdAt?.slice(0, 10) <= dateTo);
  }

  // --- sort: one field, "-" prefix means descending ---
  const sort = params.get('sort');
  if (sort) {
    const key = sort.startsWith('-') ? sort.slice(1) : sort;
    const direction = sort.startsWith('-') ? -1 : 1;

    rows.sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  }

  // --- pagination ---
  const total = rows.length;
  const perPage = Math.min(
    Math.max(1, Number(params.get('perPage')) || DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(
    Math.max(1, Number(params.get('page')) || 1),
    totalPages,
  );

  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    meta: { page, perPage, total, totalPages },
  };
}

/**
 * 422 in the standard error shape. React Hook Form maps `fields` straight onto
 * inputs with `setError(name, { message })`.
 *
 *   return validationError({ email: 'Must be a valid email address.' });
 *
 * @param {Record<string, string>} fields
 * @param {string} [message]
 */
export function validationError(
  fields,
  message = 'The submitted data is invalid.',
) {
  return HttpResponse.json(
    { error: { code: 'VALIDATION_FAILED', message, fields } },
    { status: 422 },
  );
}

/**
 * 404. Also the correct answer when a record exists but this user has no right
 * to know it exists — telling an attacker "it exists, but not for you" is an
 * information leak. See docs/api-contract.md §1.
 *
 * @param {string} [resource] e.g. "Customer"
 */
export function notFound(resource = 'Resource') {
  return HttpResponse.json(
    { error: { code: 'NOT_FOUND', message: `${resource} not found.` } },
    { status: 404 },
  );
}

/**
 * 500. Never leaks a stack trace, exactly like the real backend must not.
 *
 * @param {string} [message]
 */
export function serverError(message = 'Something went wrong on our end.') {
  return HttpResponse.json(
    { error: { code: 'SERVER_ERROR', message } },
    { status: 500 },
  );
}

/**
 * 403. Use when the user is authenticated but lacks the permission — and only
 * where the record's existence is not itself sensitive, otherwise use notFound.
 *
 * @param {string} [message]
 */
export function forbidden(message = 'You do not have permission to do that.') {
  return HttpResponse.json(
    { error: { code: 'FORBIDDEN', message } },
    { status: 403 },
  );
}
