/**
 * Suppliers API — C owns this file.
 *
 * Never call fetch here. apiClient handles the envelope, the auth header and
 * the 401 refresh; a module that calls fetch directly loses all three.
 */

import { apiClient } from '@/lib/apiClient';

const RESOURCE = '/suppliers';

/** Query keys, namespaced so invalidation never crosses module boundaries. */
export const supplierKeys = {
  all: ['suppliers'],
  lists: () => [...supplierKeys.all, 'list'],
  list: (params) => [...supplierKeys.lists(), params],
  details: () => [...supplierKeys.all, 'detail'],
  detail: (id) => [...supplierKeys.details(), id],
  purchaseOrders: (id) => [...supplierKeys.all, 'purchase-orders', id],
};

/**
 * List. Returns the whole envelope because the caller needs `meta` for
 * pagination — the one function that does not unwrap to `data`.
 *
 * @param {Record<string, unknown>} params from useTableParams().queryParams
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export function fetchSuppliers(params) {
  return apiClient.get(RESOURCE, params);
}

/** @param {string} id */
export async function fetchSupplier(id) {
  const { data } = await apiClient.get(`${RESOURCE}/${id}`);
  return data;
}

/** @param {import('./schema').SupplierInput} body */
export async function createSupplier(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

/**
 * @param {string} id
 * @param {Partial<import('./schema').SupplierInput>} body
 */
export async function updateSupplier(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

/** Archive. Returns nothing — the API answers 204. @param {string} id */
export function deleteSupplier(id) {
  return apiClient.delete(`${RESOURCE}/${id}`);
}

// ── Module-specific endpoints ────────────────────────────────────────────────

/** That supplier's purchase orders, for the detail page. @param {string} id */
export function fetchSupplierPurchaseOrders(id, params) {
  return apiClient.get(`${RESOURCE}/${id}/purchase-orders`, params);
}
