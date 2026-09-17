/**
 * Conditional className joiner.
 *
 * Deliberately not `clsx` — a new dependency in `lib/` requires review, and
 * this is four lines.
 *
 * @param {...unknown} parts
 * @returns {string}
 */
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}
