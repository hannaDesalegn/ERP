/**
 * Audit logging middleware.
 *
 * WHY THIS IS MIDDLEWARE RATHER THAN A CALL IN EVERY ROUTE
 *
 * The obvious implementation is a logAudit() call inside each write handler.
 * That would capture the prior state, which this cannot, but it would mean
 * editing roughly thirty handlers spread across every route file,
 * and an audit log that depends on thirty separate remembered calls fails the
 * first time somebody adds a route and forgets one. A log with holes in it is
 * arguably worse than none, because it is trusted.
 *
 * Mounting once in front of the routers means every state-changing request is
 * recorded, including routes that do not exist yet. The trade is that this
 * layer cannot see the prior state of a record, only the request and the
 * outcome. That limitation is documented in the model.
 *
 * Only mutations are recorded. Logging reads would bury the interesting
 * entries under thousands of list requests.
 */

import AuditLog from '../models/AuditLog.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Never store these, at any depth. */
const REDACTED_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
]);

/** Hard cap on a stored body, so one large payload cannot bloat a document. */
const MAX_BODY_CHARS = 4000;

/**
 * Deep copy with secrets replaced. Returns a plain object safe to persist.
 *
 * @param {unknown} value
 * @param {number} [depth]
 */
function redact(value, depth = 0) {
  // Bodies this project sends are shallow. The guard is for safety, not depth.
  if (depth > 6) return '[nested]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

/**
 * "/api/purchase-orders/abc123/approve" -> resource "purchase-orders",
 * recordId "abc123", action "approve".
 *
 * Derived from the URL rather than declared per route, because the API is
 * consistently resource-per-noun (docs/api-contract.md §1) and a rule that
 * holds everywhere is better than thirty declarations that can drift.
 */
function describe(method, path) {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  // Drop the leading "api".
  if (segments[0] === 'api') segments.shift();

  const resource = segments[0] ?? 'unknown';
  const looksLikeId = (s) => /^[a-f0-9]{24}$/i.test(s);

  // /products/:id/adjustments -> the trailing noun is the real action
  const recordId = segments.find(looksLikeId) ?? null;
  const tail = segments[segments.length - 1];

  let action;
  if (tail && !looksLikeId(tail) && segments.length > 1) {
    // A named operation: /approve, /submit, /receive, /adjustments.
    action = tail;
  } else if (method === 'POST') {
    action = 'create';
  } else if (method === 'DELETE') {
    action = 'delete';
  } else {
    action = 'update';
  }

  return { resource, recordId, action };
}

/**
 * Record every state-changing request once its response has been sent.
 *
 * Mount after express.json() and before the routers. It does its work on the
 * response's finish event, by which point each router's own requireAuth has
 * populated req.user.
 */
export function auditLog(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  // Captured now: a handler is free to reassign req.body, and validateBody
  // deliberately does exactly that.
  let body = null;
  try {
    const serialised = JSON.stringify(redact(req.body ?? null));
    body =
      serialised && serialised.length > MAX_BODY_CHARS
        ? { truncated: true, bytes: serialised.length }
        : JSON.parse(serialised ?? 'null');
  } catch {
    body = { unserialisable: true };
  }

  res.on('finish', () => {
    const { resource, recordId, action } = describe(
      req.method,
      req.originalUrl,
    );

    const entry = {
      userId: req.user?._id ?? null,
      userEmail: req.user?.email ?? null,
      roleName: req.user?.roleId?.name ?? null,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      resource,
      action,
      recordId,
      statusCode: res.statusCode,
      outcome: res.statusCode < 400 ? 'success' : 'failure',
      requestBody: body,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };

    // Fire and forget. The response has already been sent, and a failure to
    // write the audit entry must not turn a successful request into an error
    // for the user. It is logged server-side instead.
    AuditLog.create(entry).catch((error) => {
      console.error('Audit log write failed:', error.message);
    });
  });

  next();
}
