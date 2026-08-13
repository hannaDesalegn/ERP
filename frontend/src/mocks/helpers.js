/**
 * Shared mock helpers — owned by A, used by every module's handlers.
 *
 * Exists so all three modules paginate, delay and fail identically. See
 * docs/api-contract.md §5.
 *
 *   paginate(records, url)   → { data, meta } honouring page/perPage/search/sort
 *   delay(ms)                → realistic latency so loading states get exercised
 *   validationError(fields)  → 422 in the standard { error: { fields } } shape
 */

// TODO(A): implement.
export {};
