/**
 * Formatting helpers — owned by A.
 *
 * Money is an integer in minor units everywhere in this app
 * (docs/entities.md § Money is an integer). These functions are the ONLY place
 * that integer becomes a string, and the only place a string becomes that
 * integer. Never do arithmetic on a formatted string.
 */

const DEFAULT_LOCALE = 'en-US';

/**
 * Minor units per major unit, by ISO 4217 code. Anything not listed is 2,
 * which covers ETB, USD, EUR and every currency this project will see.
 */
const MINOR_UNIT_EXPONENT = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
};

/** @param {string} currency @returns {number} */
function exponentFor(currency) {
  return MINOR_UNIT_EXPONENT[String(currency).toUpperCase()] ?? 2;
}

/**
 * Intl separates code from number with a no-break space — U+00A0, or U+202F in
 * some locales. Normalise both to a plain space so output is greppable.
 *
 * Written as escapes rather than the literal characters: they are invisible in
 * an editor, indistinguishable from a normal space in review, and eslint's
 * no-irregular-whitespace rejects them outright.
 */
function normaliseSpaces(value) {
  return value.replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * Format an integer amount in minor units for display.
 *
 *   formatMoney(149900, 'ETB')  // → "ETB 1,499.00"
 *   formatMoney(null, 'ETB')    // → "—"
 *
 * @param {number|null|undefined} minorUnits integer, minor units
 * @param {string} [currency] ISO 4217
 * @param {{ locale?: string, showCurrency?: boolean }} [options]
 * @returns {string}
 */
export function formatMoney(minorUnits, currency = 'ETB', options = {}) {
  const { locale = DEFAULT_LOCALE, showCurrency = true } = options;
  if (minorUnits === null || minorUnits === undefined) return '—';
  if (!Number.isFinite(minorUnits)) return '—';

  const exponent = exponentFor(currency);
  const major = minorUnits / 10 ** exponent;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major);

  return showCurrency
    ? normaliseSpaces(`${String(currency).toUpperCase()} ${formatted}`)
    : formatted;
}

/**
 * Parse a human-typed amount into an integer in minor units.
 * Rounds half away from zero — never truncates, because truncating loses a cent
 * on every line and an ERP that loses cents is worthless.
 *
 *   parseMoney('1499.00')   // → 149900
 *   parseMoney('1,499')     // → 149900
 *   parseMoney('')          // → null
 *
 * @param {string|number|null|undefined} input
 * @param {string} [currency] ISO 4217 — decides the exponent
 * @returns {number|null} integer minor units, or null if not parseable
 */
export function parseMoney(input, currency = 'ETB') {
  if (input === null || input === undefined || input === '') return null;

  const cleaned = String(input)
    // \s already covers every Unicode space separator, including the no-break
    // spaces Intl emits — the literal U+00A0 that used to sit in this class was
    // redundant as well as invisible.
    .replace(/[\s,]/g, '')
    .replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;

  const major = Number(cleaned);
  if (!Number.isFinite(major)) return null;

  const scaled = major * 10 ** exponentFor(currency);
  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

/**
 * Parse a "YYYY-MM-DD" date-only string without timezone drift.
 * `new Date('2026-08-08')` is parsed as UTC midnight and renders as the 7th in
 * any negative-offset timezone. This does not.
 *
 * @param {string} value
 * @returns {Date|null}
 */
function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Format a date for display. Accepts a date-only "YYYY-MM-DD" or a full ISO
 * UTC timestamp; date-only values are never shifted by the viewer's timezone.
 *
 *   formatDate('2026-08-08')            // → "8 Aug 2026"
 *   formatDate('2026-08-08T09:30:00Z')  // → "8 Aug 2026"
 *
 * @param {string|null|undefined} value
 * @param {{ locale?: string, format?: 'short'|'long' }} [options]
 * @returns {string}
 */
export function formatDate(value, options = {}) {
  const { locale = DEFAULT_LOCALE, format = 'short' } = options;
  if (!value) return '—';

  const date = parseDateOnly(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format an ISO timestamp with the time of day, in the viewer's local zone.
 *
 *   formatDateTime('2026-08-08T09:30:00Z')  // → "8 Aug 2026, 12:30"
 *
 * @param {string|null|undefined} value
 * @param {{ locale?: string }} [options]
 * @returns {string}
 */
export function formatDateTime(value, options = {}) {
  const { locale = DEFAULT_LOCALE } = options;
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return normaliseSpaces(
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  );
}

/**
 * Format a quantity. Decimals are allowed (2.5 kg) — quantities are not money.
 *
 * @param {number|null|undefined} value
 * @param {{ locale?: string, unit?: string|null }} [options]
 * @returns {string}
 */
export function formatNumber(value, options = {}) {
  const { locale = DEFAULT_LOCALE, unit = null } = options;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Turn a stored enum into a label: "pending_approval" → "Pending approval".
 * Display only. Never localise or transform the value that goes on the wire.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatEnum(value) {
  if (!value) return '—';
  const spaced = String(value).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Gate a URL before it reaches an `href`.
 *
 * `javascript:` URLs are a real XSS vector and user-supplied links are exactly
 * where they arrive. Anything that is not a known-safe scheme returns null, and
 * the caller renders plain text instead of a link.
 * See docs/security-notes.md § XSS.
 *
 * @param {string|null|undefined} url
 * @returns {string|null} the URL if safe, otherwise null
 */
export function safeUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (trimmed === '') return null;

  // Relative URLs never carry a scheme, so they cannot be javascript:.
  // Reject protocol-relative "//evil.test" — it is an absolute URL in disguise.
  if (trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed, window.location.origin);
  } catch {
    return null;
  }

  return SAFE_URL_SCHEMES.has(parsed.protocol) ? trimmed : null;
}
