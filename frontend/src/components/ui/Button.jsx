import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

const VARIANTS = {
  primary: 'bg-primary text-primary-fg border-primary hover:bg-primary-hover',
  secondary: 'bg-surface text-text border-border hover:bg-bg',
  ghost: 'bg-transparent text-text border-transparent hover:bg-bg',
  destructive: 'bg-danger text-white border-danger hover:opacity-90',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
};

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'destructive'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {React.ElementType} [props.icon] a lucide icon component
 * @param {'left'|'right'} [props.iconPosition]
 * @param {boolean} [props.disabled]
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    disabled = false,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  // A loading button must not fire twice, so loading implies disabled.
  const isDisabled = disabled || loading;
  const iconSize = size === 'lg' ? 16 : 14;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md border font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={iconSize} className="animate-spin" />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={iconSize} />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon size={iconSize} />}
    </button>
  );
});
