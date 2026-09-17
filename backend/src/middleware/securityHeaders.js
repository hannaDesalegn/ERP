/**
 * Response security headers.
 *
 * docs/security-notes.md §4 lists these as a backend requirement.
 *
 * Hand-written rather than adding helmet, for the same reason as the rate
 * limiter: new dependencies in shared code require review, and this is a
 * handful of static headers.
 *
 * SCOPE NOTE: this API returns JSON, never HTML, so the headers that matter
 * most here are the ones that stop a browser guessing a content type or framing
 * a response. The full Content-Security-Policy belongs on the frontend, which
 * is served by Vercel — it is set in frontend/vercel.json, not here.
 */

/** One year, the usual minimum for preload eligibility. */
const HSTS_MAX_AGE = 31536000;

export function securityHeaders(req, res, next) {
  // Never let a browser second-guess a declared content type. Without this a
  // JSON response containing attacker-controlled text can be sniffed as HTML
  // and executed.
  res.set('X-Content-Type-Options', 'nosniff');

  // Nothing here should ever be framed.
  res.set('X-Frame-Options', 'DENY');
  res.set('Content-Security-Policy', "frame-ancestors 'none'");

  // Do not leak the full path of an API call in the Referer header.
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // No reason for a browser to grant this origin any of these.
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Only meaningful over TLS, and actively unhelpful in local development where
  // it would pin localhost to HTTPS in the developer's browser for a year.
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.set(
      'Strict-Transport-Security',
      `max-age=${HSTS_MAX_AGE}; includeSubDomains`,
    );
  }

  next();
}
