/**
 * Orders API — B owns this file.
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

const RESOURCE = '/orders';

/**
 * Query keys, namespaced so one module's invalidation never clears another's
 * cache. Always build keys from here — a hand-written ['orders','list'] in a
 * component will silently stop matching the day this changes.
 */
export const orderKeys = {
  all: ['orders'],
  lists: () => [...orderKeys.all, 'list'],
  list: (params) => [...orderKeys.lists(), params],
  details: () => [...orderKeys.all, 'detail'],
  detail: (id) => [...orderKeys.details(), id],
};

/**
 * List. Returns the whole envelope because the caller needs `meta` for
 * pagination — this is the one function that does not unwrap to `data`.
 *
 * @param {Record<string, unknown>} params from useTableParams().queryParams
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export function fetchOrders(params) {
  return apiClient.get(RESOURCE, params);
}

/** @param {string} id */
export async function fetchOrder(id) {
  const { data } = await apiClient.get(`${RESOURCE}/${id}`);
  return data;
}

/** @param {import('./schema').SalesOrderInput} body */
export async function createOrder(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

/**
 * @param {string} id
 * @param {Partial<import('./schema').SalesOrderInput>} body
 */
export async function updateOrder(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

/** Archive. Returns nothing — the API answers 204. @param {string} id */
export function deleteOrder(id) {
  return apiClient.delete(`${RESOURCE}/${id}`);
}

// ── Module-specific endpoints ────────────────────────────────────────────────
// Anything beyond the five verbs lives here and is owned by this module.

/** @param {string} id */
export function fetchOrderInvoices(id, params) {
  return apiClient.get(`${RESOURCE}/${id}/invoices`, params);
}