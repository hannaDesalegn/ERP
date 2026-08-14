/**
 * Conditional className joiner.
 *
 * Deliberately not `clsx` — README §4 requires all three owners to agree before
 * a new dependency lands in `lib/`, and this is four lines.
 *
 * @param {...unknown} parts
 * @returns {string}
 */
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}
