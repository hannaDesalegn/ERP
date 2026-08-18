import { cn } from '@/lib/cn';
import { formatEnum } from '@/lib/format';

/**
 * Status → variant map from docs/components.md § Display.
 * Central so `approved` is the same green in every module and three people
 * don't pick three greens. Adding a status to docs/entities.md means adding it
 * here too.
 */
const STATUS_VARIANTS = {
  // success
  active: 'success',
  approved: 'success',
  paid: 'success',
  received: 'success',
  fulfilled: 'success',
  // warning
  pending_approval: 'warning',
  partially_paid: 'warning',
  partially_received: 'warning',
  low_stock: 'warning',
  // danger
  overdue: 'danger',
  blocked: 'danger',
  cancelled: 'danger',
  void: 'danger',
  out_of_stock: 'danger',
  suspended: 'danger',
  // neutral
  draft: 'neutral',
  inactive: 'neutral',
  discontinued: 'neutral',
  // info
  sent: 'info',
  invited: 'info',
};

const VARIANT_CLASSES = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-bg text-text-muted border border-border',
};

/**
 * @param {object} props
 * @param {string} props.status the stored enum value, e.g. "pending_approval"
 * @param {'auto'|'success'|'warning'|'danger'|'info'|'neutral'} [props.variant]
 */
export function StatusBadge({ status, variant = 'auto', className }) {
  let resolved = variant;

  if (variant === 'auto') {
    resolved = STATUS_VARIANTS[status];
    if (!resolved) {
      // Unknown status → neutral plus a warning, so a missing map entry is
      // noticed in development instead of shipping as a silent grey pill.
      console.error(
        `StatusBadge: no variant mapped for status "${status}". Falling back to neutral — add it to STATUS_VARIANTS.`,
      );
      resolved = 'neutral';
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[resolved],
        className,
      )}
    >
      {formatEnum(status)}
    </span>
  );
}
