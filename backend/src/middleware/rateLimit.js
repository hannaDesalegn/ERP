/**
 * Login rate limiting — added by C ahead of the external security review.
 *
 * docs/backend-plan.md §7 put rate limiting out of scope for the four-day
 * build, which was the right call for something running on one laptop. The
 * application is now publicly reachable and being tested by an external team,
 * so an unthrottled login endpoint is a different proposition: an attacker can
 * try passwords as fast as the network allows.
 *
 * Deliberately hand-written rather than pulling in express-rate-limit. The
 * README requires all three of us to agree before a dependency lands in shared
 * code, and the supply chain is called out in docs/security-notes.md as our
 * most realistic risk. Forty lines we can read beats a package we cannot.
 *
 * LIMITATIONS, stated plainly because they belong in the pentest handover:
 *  - State lives in this process's memory. A restart clears it, and two Render
 *    instances would each keep their own count. Redis is the real answer and is
 *    out of scope here.
 *  - The client IP comes from Express, which trusts X-Forwarded-For only when
 *    `trust proxy` is set. app.js sets it, because Render terminates TLS in
 *    front of us and every request would otherwise appear to come from one
 *    address.
 */

import { ApiError } from './error.js';

/** Rolling window, in milliseconds. */
const WINDOW_MS = 15 * 60 * 1000;

/** Attempts allowed per window, per key. */
const MAX_PER_IP = 20;
const MAX_PER_ACCOUNT = 5;

/**
 * key -> { count, firstAttemptAt }
 * Two maps rather than one so a shared office address cannot lock out an
 * account, and one account under attack cannot lock out everyone behind a NAT.
 */
const byIp = new Map();
const byAccount = new Map();

/** Drop entries whose window has passed, so the maps cannot grow without end. */
function sweep(store, now) {
  for (const [key, entry] of store) {
    if (now - entry.firstAttemptAt > WINDOW_MS) store.delete(key);
  }
}

/**
 * @returns {{ blocked: boolean, retryAfterSeconds: number }}
 */
function record(store, key, max, now) {
  const entry = store.get(key);

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttemptAt: now });
    return { blocked: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;

  return {
    blocked: entry.count > max,
    retryAfterSeconds: Math.ceil(
      (WINDOW_MS - (now - entry.firstAttemptAt)) / 1000,
    ),
  };
}

/**
 * Throttle login attempts by source address and by the account being targeted.
 *
 * Mount in front of POST /api/auth/login only. Applying it to the whole API
 * would throttle ordinary use of a list screen.
 */
export function loginRateLimit(req, res, next) {
  const now = Date.now();

  // Cheap enough to do on every login attempt, and keeps memory bounded
  // without a timer holding the process open.
  sweep(byIp, now);
  sweep(byAccount, now);

  const ip = req.ip ?? 'unknown';
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();

  const ipResult = record(byIp, ip, MAX_PER_IP, now);
  const accountResult = email
    ? record(byAccount, email, MAX_PER_ACCOUNT, now)
    : { blocked: false, retryAfterSeconds: 0 };

  if (ipResult.blocked || accountResult.blocked) {
    const retryAfter = Math.max(
      ipResult.retryAfterSeconds,
      accountResult.retryAfterSeconds,
    );

    res.set('Retry-After', String(retryAfter));

    // The same message either way. Saying which limit was hit would tell an
    // attacker whether the account they are guessing at exists.
    return next(
      ApiError.rateLimited('Too many sign-in attempts. Try again shortly.'),
    );
  }

  next();
}
