/**
 * Write protection: throttling, idempotency and duplicate rejection for every
 * state-changing request.
 *
 * Added after the September 2026 penetration test (finding vuln-1). The tester
 * captured an authenticated POST /api/customers and replayed it twenty times
 * concurrently; every copy was accepted and twenty identical customers were
 * created. Three separate gaps made that possible, and this file closes each:
 *
 *  1. No limit on how fast one account could write. Fixed by a per-account
 *     and a per-address rolling window on POST, PUT, PATCH and DELETE.
 *  2. No idempotency. A client may now send an Idempotency-Key header; a
 *     second request with the same key from the same account gets the stored
 *     response replayed instead of creating a second record. A replayed
 *     capture carries the original key, so it creates nothing.
 *  3. No duplicate detection. A POST whose body is identical to one the same
 *     account sent to the same path in the last DUPLICATE_WINDOW_MS is refused
 *     with 409, whether or not it carries a (fresh) Idempotency-Key.
 *
 * Mounted once in app.js, in front of every router, for the same reason the
 * audit log is: a route added later is covered without anyone remembering to
 * opt it in.
 *
 * Identity: the guard runs before the routers, so before requireAuth. It
 * verifies the Bearer token itself only to learn whose request this is. An
 * absent or invalid token falls back to the client address, and the route's
 * own requireAuth still rejects it a moment later; nothing here grants access.
 *
 * LIMITATIONS, stated plainly (the same ones as rateLimit.js):
 *  - State is in this process's memory. A restart clears it, and two
 *    instances would each keep their own. Redis is the real answer.
 *  - Idempotency replay covers responses held in memory for
 *    IDEMPOTENCY_WINDOW_MS. A key reused after that is treated as new.
 */

import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { ApiError } from './error.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Login has its own, stricter limiter in rateLimit.js. */
const EXEMPT_PATHS = new Set(['/api/auth/login']);

const WINDOW_MS = 60 * 1000;

/**
 * Writes allowed per minute. Thirty per account is far above what a person
 * filling in forms produces and far below what a replay tool produces. The
 * address limit is higher so a shared office NAT is not one account's budget.
 */
const MAX_WRITES_PER_ACCOUNT = 30;
const MAX_WRITES_PER_IP = 120;

/**
 * Creates are the expensive, accumulating kind of write, so they get their
 * own, tighter budget on top of the general one.
 */
const MAX_CREATES_PER_ACCOUNT = 10;

const DUPLICATE_WINDOW_MS = 60 * 1000;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Keys longer than this are refused rather than stored. */
const MAX_KEY_LENGTH = 255;

const writesByAccount = new Map();
const writesByIp = new Map();
const createsByAccount = new Map();
/** fingerprint -> seenAt */
const recentBodies = new Map();
/** account|key -> { status, body, storedAt } or { pending: true, storedAt } */
const idempotent = new Map();

function sweepWindow(store, windowMs, now) {
  for (const [key, entry] of store) {
    if (now - entry.firstAt > windowMs) store.delete(key);
  }
}

function sweepTimestamps(store, windowMs, field, now) {
  for (const [key, entry] of store) {
    const at = typeof entry === 'number' ? entry : entry[field];
    if (now - at > windowMs) store.delete(key);
  }
}

/** @returns {number} seconds until the window resets, or 0 if under the limit */
function hit(store, key, max, now) {
  const entry = store.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now });
    return 0;
  }
  entry.count += 1;
  return entry.count > max
    ? Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 1000)
    : 0;
}

/** The account id from a valid token, or null. Never throws. */
function accountOf(req) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).sub ?? null;
  } catch {
    return null;
  }
}

function fingerprint(account, req) {
  return createHash('sha256')
    .update(`${account}\n${req.method}\n${req.originalUrl}\n`)
    .update(JSON.stringify(req.body ?? null))
    .digest('hex');
}

export function writeGuard(req, res, next) {
  if (!WRITE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const now = Date.now();
  sweepWindow(writesByAccount, WINDOW_MS, now);
  sweepWindow(writesByIp, WINDOW_MS, now);
  sweepWindow(createsByAccount, WINDOW_MS, now);
  sweepTimestamps(recentBodies, DUPLICATE_WINDOW_MS, null, now);
  sweepTimestamps(idempotent, IDEMPOTENCY_WINDOW_MS, 'storedAt', now);

  const account = accountOf(req);
  const ip = req.ip ?? 'unknown';
  const who = account ? `user:${account}` : `ip:${ip}`;

  // ── 1. Throttling ──────────────────────────────────────────────────────────
  const waits = [
    hit(writesByIp, ip, MAX_WRITES_PER_IP, now),
    account ? hit(writesByAccount, account, MAX_WRITES_PER_ACCOUNT, now) : 0,
    account && req.method === 'POST'
      ? hit(createsByAccount, account, MAX_CREATES_PER_ACCOUNT, now)
      : 0,
  ];
  const retryAfter = Math.max(...waits);
  if (retryAfter > 0) {
    res.set('Retry-After', String(retryAfter));
    return next(ApiError.rateLimited('Too many changes in a short time. Try again shortly.'));
  }

  // ── 2. Idempotency-Key ─────────────────────────────────────────────────────
  const key = req.get('idempotency-key');
  if (key !== undefined) {
    if (!key || key.length > MAX_KEY_LENGTH) {
      return next(ApiError.validation(undefined, 'Idempotency-Key must be 1 to 255 characters.'));
    }

    const storeKey = `${who}|${key}`;
    const stored = idempotent.get(storeKey);

    if (stored?.pending) {
      // The first request with this key is still running. A concurrent replay
      // lands here, which is exactly the attack in the report.
      return next(ApiError.conflict('A request with this Idempotency-Key is already in progress.'));
    }
    if (stored) {
      res.set('Idempotent-Replayed', 'true');
      return res.status(stored.status).json(stored.body);
    }

    idempotent.set(storeKey, { pending: true, storedAt: now });

    // Capture the response so a retry gets the same answer. Only successes are
    // kept: a 422 or 500 should be retryable with the same key once fixed.
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        idempotent.set(storeKey, { status: res.statusCode, body, storedAt: Date.now() });
      } else {
        idempotent.delete(storeKey);
      }
      return json(body);
    };
    res.on('close', () => {
      if (idempotent.get(storeKey)?.pending) idempotent.delete(storeKey);
    });
    // Falls through to the body check: a fresh key on every copy of the same
    // body is the obvious way around idempotency, and the body check catches it.
  }

  // ── 3. Duplicate body ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const print = fingerprint(who, req);
    if (recentBodies.has(print)) {
      return next(
        ApiError.conflict('An identical request was just submitted. Check whether it already went through.'),
      );
    }
    recentBodies.set(print, now);
    // A rejected request created nothing, so an honest retry of it must not
    // be mistaken for a duplicate.
    res.on('finish', () => {
      if (res.statusCode >= 400) recentBodies.delete(print);
    });
  }

  next();
}

/** For tests only: forget everything. */
export function resetWriteGuard() {
  for (const store of [writesByAccount, writesByIp, createsByAccount, recentBodies, idempotent]) {
    store.clear();
  }
}
