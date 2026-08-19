/**
 * Invoices API — B owns this file.
 *
 * ── COPYING THIS MODULE ──────────────────────────────────────────────────────
 * CHANGE: the RESOURCE constant, the key namespace, and any module-specific
 *         endpoints at the bottom.
 * KEEP:   the shape. Every module is the same five verbs against the same
 *         envelope, which is exactly why B's and C's work never overlaps.
 * Never call fetch here. apiClient handles the envelope, the auth header and
 * the 401 refresh; a module that calls fetch directly loses all three.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { apiClient } from '@/lib/apiClient';

const RESOURCE = '/invoices';

/**
 * Query keys, namespaced so one module's invalidation never clears another's
 * cache. Always build keys from here — a hand-written ['invoices','list'] in a
 * component will silently stop matching the day this changes.
 */
export const invoiceKeys = {
  all: ['invoices'],
  lists: () => [...invoiceKeys.all, 'list'],
  list: (params) => [...invoiceKeys.lists(), params],
  details: () => [...invoiceKeys.all, 'detail'],
  detail: (id) => [...invoiceKeys.details(), id],
};

/**
 * List. Returns the whole envelope because the caller needs `meta` for
 * pagination — this is the one function that does not unwrap to `data`.
 *
 * @param {Record<string, unknown>} params from useTableParams().queryParams
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export function fetchInvoices(params) {
  return apiClient.get(RESOURCE, params);
}

/** @param {string} id */
export async function fetchInvoice(id) {
  const { data } = await apiClient.get(`${RESOURCE}/${id}`);
  return data;
}

/** @param {import('./schema').InvoiceInput} body */
export async function createInvoice(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

/**
 * @param {string} id
 * @param {Partial<import('./schema').InvoiceInput>} body
 */
export async function updateInvoice(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

/** Archive. Returns nothing — the API answers 204. @param {string} id */
export function deleteInvoice(id) {
  return apiClient.delete(`${RESOURCE}/${id}`);
}