/**
 * fetch wrapper — owned by A. Nobody else calls fetch directly.
 *
 * Every response in this app is enveloped (`{ data, meta }` or `{ error }`),
 * so this is the one place that unwraps it. Module `api.js` files get plain
 * data back and never think about the envelope.
 *
 * See docs/api-contract.md §1 and §3.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * A failed request, carrying the server's error envelope.
 *
 * `fields` is populated only on VALIDATION_FAILED (422) and maps straight onto
 * a form with React Hook Form's `setError(name, { message })`.
 */
export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields ?? null;
  }
}

/**
 * TODO(A), week 2: the access token lives in AuthProvider's React state, never
 * in localStorage. This module reads it through a setter rather than importing
 * React state directly. On 401, call /auth/refresh once, retry, and share a
 * single refresh promise across concurrent 401s.
 */
let accessToken = null;

/** @param {string|null} token */
export function setAccessToken(token) {
  accessToken = token;
}

/**
 * @param {string} path e.g. "/customers"
 * @param {Record<string, unknown>} [params] query string values; arrays repeat the key
 * @returns {string}
 */
function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    // Repeatable filters: ?status=draft&status=sent
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.pathname + url.search;
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, params?: Record<string, unknown> }} [options]
 * @returns {Promise<{ data: unknown, meta?: object }|null>} null for 204
 */
async function request(path, options = {}) {
  const { method = 'GET', body, params } = options;

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    // The refresh token is an httpOnly cookie the JS never sees.
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content — DELETE succeeds with no body to parse.
  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'SERVER_ERROR',
      message: 'The server returned an unreadable response.',
    });
  }

  if (!response.ok) {
    // Surface the server's own message. Never a raw body or stack trace —
    // docs/security-notes.md § Not leaking data in the UI.
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'SERVER_ERROR',
      message: payload?.error?.message ?? 'Something went wrong.',
      fields: payload?.error?.fields,
    });
  }

  return payload;
}

export const apiClient = {
  /** @returns {Promise<{ data: unknown, meta?: object }>} */
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
