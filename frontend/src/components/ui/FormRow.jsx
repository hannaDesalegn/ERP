/**
 * Form row — owned by A. Puts fields side by side on wide screens.
 *
 * One column below 768px, always. Two half-width inputs on a phone are two
 * cramped inputs, and every field in this kit is full-width by default.
 *
 * @param {object} props
 * @param {1|2|3|4} [props.columns] applies from md up
 */

import { cn } from '@/lib/cn';

// Whole class names, not built from a template string — Tailwind scans source
// text and never sees `md:grid-cols-${columns}`. Same reason as DataTable's
// responsive column map.
const COLUMNS = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export function FormRow({ columns = 2, className, children }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        COLUMNS[columns] ?? COLUMNS[2],
        className,
      )}
    >
      {children}
    </div>
  );
}
