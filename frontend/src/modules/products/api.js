/**
 * Products API — C owns this file.
 *
 * Never call fetch here. apiClient handles the envelope, the auth header and
 * the 401 refresh; a module that calls fetch directly loses all three.
 */

import { apiClient } from '@/lib/apiClient';

const RESOURCE = '/products';

/**
 * Query keys, namespaced so invalidating products never clears another
 * module's cache. Always build keys from here — a hand-written
 * ['products','list'] in a component silently stops matching the day this
 * changes.
 */
export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (params) => [...productKeys.lists(), params],
  details: () => [...productKeys.all, 'detail'],
  detail: (id) => [...productKeys.details(), id],
  categories: () => [...productKeys.all, 'categories'],
  adjustments: (id) => [...productKeys.all, 'adjustments', id],
};

/**
 * List. Returns the whole envelope because the caller needs `meta` for
 * pagination — the one function that does not unwrap to `data`.
 *
 * @param {Record<string, unknown>} params from useTableParams().queryParams
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export function fetchProducts(params) {
  return apiClient.get(RESOURCE, params);
}

/** @param {string} id */
export async function fetchProduct(id) {
  const { data } = await apiClient.get(`${RESOURCE}/${id}`);
  return data;
}

/** @param {import('./schema').ProductInput} body */
export async function createProduct(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

/**
 * @param {string} id
 * @param {Partial<import('./schema').ProductInput>} body
 */
export async function updateProduct(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

/** Archive. Returns nothing — the API answers 204. @param {string} id */
export function deleteProduct(id) {
  return apiClient.delete(`${RESOURCE}/${id}`);
}

// ── Module-specific endpoints ────────────────────────────────────────────────

/**
 * The category catalogue, for the form's select.
 * @returns {Promise<{ id: string, name: string }[]>}
 */
export async function fetchProductCategories() {
  const { data } = await apiClient.get(`${RESOURCE}/categories`);
  return data;
}

/** Stock movement history for one product. @param {string} id */
export function fetchProductAdjustments(id, params) {
  return apiClient.get(`${RESOURCE}/${id}/adjustments`, params);
}

/**
 * Record a stock movement. This is the only way quantityOnHand changes —
 * there is deliberately no endpoint that sets it directly.
 *
 * @param {string} id
 * @param {import('./schema').StockAdjustmentInput} body
 */
export async function createProductAdjustment(id, body) {
  const { data } = await apiClient.post(`${RESOURCE}/${id}/adjustments`, body);
  return data;
}
