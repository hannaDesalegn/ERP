/**
 * Skeleton — owned by A.
 *
 * motion-safe, not the global reduced-motion rule: that shortens the animation
 * to 0.01ms, and a pulse should be absent rather than frozen.
 */

import { cn } from '@/lib/cn';

/** bg-border reads on both surface and the page background. */
const BAR = 'motion-safe:animate-pulse rounded-sm bg-border';

/**
 * @param {object} props
 * @param {'text'|'card'|'table'|'form'} [props.variant]
 * @param {number} [props.rows] text and table only; card and form ignore it
 */
export function Skeleton({ variant = 'text', rows = 5 }) {
  if (variant === 'card') return <CardSkeleton />;
  if (variant === 'table') return <TableSkeleton rows={rows} />;
  if (variant === 'form') return <FormSkeleton />;
  return <TextSkeleton rows={rows} />;
}

/** One wrapper for every variant, so assistive tech hears "Loading" once. */
function Frame({ className, children }) {
  return (
    <div role="status" aria-label="Loading" className={className}>
      {children}
    </div>
  );
}

function TextSkeleton({ rows }) {
  return (
    <Frame className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        // Last line short, the way a real paragraph ends.
        <div
          key={index}
          className={cn(BAR, 'h-3', index === rows - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </Frame>
  );
}

function CardSkeleton() {
  return (
    <Frame className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className={cn(BAR, 'h-4 w-1/3')} />
      <div className={cn(BAR, 'h-3 w-full')} />
      <div className={cn(BAR, 'h-3 w-4/5')} />
    </Frame>
  );
}

function TableSkeleton({ rows }) {
  return (
    <Frame className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5">
        <div className={cn(BAR, 'h-3 w-1/4')} />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="border-b border-border px-3 py-3.5 last:border-b-0"
        >
          <div className={cn(BAR, 'h-3 w-full')} />
        </div>
      ))}
    </Frame>
  );
}

function FormSkeleton() {
  return (
    <Frame className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <div className={cn(BAR, 'h-3 w-24')} />
          <div className={cn(BAR, 'h-9 w-full')} />
        </div>
      ))}
    </Frame>
  );
}
