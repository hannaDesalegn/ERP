/**
 * KPI card — owned by A. A single number with optional context.
 */

import { ArrowDown, ArrowUp } from 'lucide-react';

import { cn } from '@/lib/cn';

import { Skeleton } from './Skeleton';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.value pre-formatted — use formatMoney for money
 * @param {React.ElementType} [props.icon] a lucide icon component
 * @param {{ value: number, direction: 'up'|'down', label?: string }} [props.trend]
 * @param {boolean} [props.loading]
 * @param {() => void} [props.onClick]
 */
export function KPICard({ title, value, icon: Icon, trend, loading, onClick }) {
  // The kit's own card skeleton rather than a second pulse implementation.
  if (loading) return <Skeleton variant="card" />;

  // A real button when it does something, so it is keyboard-reachable.
  const Root = onClick ? 'button' : 'div';
  const up = trend?.direction === 'up';
  const TrendIcon = up ? ArrowUp : ArrowDown;

  return (
    <Root
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-md border border-border bg-surface p-4 text-left',
        onClick && 'hover:bg-bg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-muted">{title}</p>
        {Icon && (
          <Icon
            size={16}
            aria-hidden="true"
            className="shrink-0 text-text-muted"
          />
        )}
      </div>

      {/* tabular-nums so digits line up across a row of cards. */}
      <p className="text-2xl font-semibold tabular-nums text-text">{value}</p>

      {trend && (
        // Direction alone decides the colour — the signature carries no notion
        // of whether up is good news for this particular metric.
        <p
          className={cn(
            'flex items-center gap-1 text-xs',
            up ? 'text-success' : 'text-danger',
          )}
        >
          <TrendIcon size={12} aria-hidden="true" />
          <span className="font-medium tabular-nums">{trend.value}%</span>
          {trend.label && (
            <span className="text-text-muted">{trend.label}</span>
          )}
        </p>
      )}
    </Root>
  );
}
