/**
 * Formatting helpers — owned by A.
 *
 * Money is an integer in minor units everywhere in this app (see
 * docs/entities.md § Money is an integer). These functions are the only place
 * it becomes a string, and the only place a string becomes an integer.
 *
 *   formatMoney(149900, 'ETB')  // → "ETB 1,499.00"
 *   parseMoney('1499.00')       // → 149900
 *
 * Also home to `safeUrl()` — user input never reaches an href without a scheme
 * check. See docs/security-notes.md § XSS.
 */

// TODO(A): implement formatMoney, parseMoney, formatDate, formatNumber, safeUrl.
export {};
