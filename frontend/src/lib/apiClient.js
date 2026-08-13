/**
 * fetch wrapper — owned by A. Nobody else calls fetch directly.
 *
 * Responsibilities (see docs/api-contract.md §3):
 *  - attach `Authorization: Bearer <accessToken>` from in-memory auth state
 *  - unwrap the `{ data, meta }` envelope, throw on the `{ error }` envelope
 *  - on 401: call /auth/refresh once, retry the original request, and if the
 *    refresh also fails clear auth state and redirect to /login?next=<path>
 *  - concurrent 401s share a single refresh promise
 */

// TODO(A): implement.
export {};
