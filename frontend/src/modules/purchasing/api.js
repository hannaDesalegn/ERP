/**
 * Purchase orders API — C owns this file.
 *
 * Never call fetch here. apiClient handles the envelope, the auth header and
 * the 401 refresh; a module that calls fetch directly loses all three.
 */

import { apiClient } from '@/lib/apiClient';

const RESOURCE = '/purchase-orders';

/** Query keys, namespaced so invalidation never crosses module boundaries. */
export const purchaseOrderKeys = {
  all: ['purchase-orders'],
  lists: () => [...purchaseOrderKeys.all, 'list'],
  list: (params) => [...purchaseOrderKeys.lists(), params],
  details: () => [...purchaseOrderKeys.all, 'detail'],
  detail: (id) => [...purchaseOrderKeys.details(), id],
  // Pickers used by the form. Namespaced under this module because they are
  // this module's cache entries, even though the data comes from elsewhere.
  supplierOptions: () => [...purchaseOrderKeys.all, 'supplier-options'],
  productOptions: (search) => [
    ...purchaseOrderKeys.all,
    'product-options',
    search ?? '',
  ],
};

/**
 * List. Returns the whole envelope because the caller needs `meta` for
 * pagination.
 *
 * @param {Record<string, unknown>} params from useTableParams().queryParams
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export function fetchPurchaseOrders(params) {
  return apiClient.get(RESOURCE, params);
}

/** @param {string} id */
export async function fetchPurchaseOrder(id) {
  const { data } = await apiClient.get(`${RESOURCE}/${id}`);
  return data;
}

/** @param {import('./schema').PurchaseOrderInput} body */
export async function createPurchaseOrder(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

/**
 * @param {string} id
 * @param {Partial<import('./schema').PurchaseOrderInput>} body
 */
export async function updatePurchaseOrder(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

// ── Status transitions ───────────────────────────────────────────────────────
// POST actions, not PATCH. A status change is a business operation with its own
// rules and its own permission — it is not a field edit, and this is what stops
// a crafted PATCH body from skipping approval.
// docs/api-contract.md § Status transitions are POST actions.

/** draft → pending_approval. @param {string} id */
export async function submitPurchaseOrder(id) {
  const { data } = await apiClient.post(`${RESOURCE}/${id}/submit`);
  return data;
}

/** pending_approval → approved. @param {string} id */
export async function approvePurchaseOrder(id) {
  const { data } = await apiClient.post(`${RESOURCE}/${id}/approve`);
  return data;
}

/** → cancelled. @param {string} id */
export async function cancelPurchaseOrder(id) {
  const { data } = await apiClient.post(`${RESOURCE}/${id}/cancel`);
  return data;
}

/**
 * Record a delivery. approved → partially_received → received.
 *
 * @param {string} id
 * @param {import('./schema').ReceiveGoodsInput} body
 */
export async function receivePurchaseOrder(id, body) {
  const { data } = await apiClient.post(`${RESOURCE}/${id}/receive`, body);
  return data;
}

// ── Pickers ──────────────────────────────────────────────────────────────────
// The form needs to choose a supplier and products. These hit the real
// /suppliers and /products endpoints from docs/api-contract.md rather than
// importing another module's api.js — a module importing another module's code
// is exactly the coupling the folder split exists to prevent, and the HTTP call
// is what the real backend will serve anyway.

/** @returns {Promise<{ value: string, label: string }[]>} */
export async function fetchSupplierOptions() {
  const { data } = await apiClient.get('/suppliers', {
    perPage: 100,
    status: 'active',
    sort: 'name',
  });
  return data.map((supplier) => ({
    value: supplier.id,
    label: `${supplier.code} — ${supplier.name}`,
  }));
}

/**
 * Active products, for the line picker. Carries the price so choosing a
 * product can prefill the line's unit price.
 *
 * @returns {Promise<{ value: string, label: string, costPrice: number, sku: string }[]>}
 */
export async function fetchProductOptions() {
  const { data } = await apiClient.get('/products', {
    perPage: 100,
    status: 'active',
    sort: 'name',
  });
  return data.map((product) => ({
    value: product.id,
    label: `${product.sku} — ${product.name}`,
    sku: product.sku,
    // What we pay the supplier, so it is the sensible default for a PO line.
    costPrice: product.costPrice,
  }));
}
