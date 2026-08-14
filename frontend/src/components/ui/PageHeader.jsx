import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {{ label: string, path: string }[]} [props.breadcrumbs]
 * @param {React.ReactNode} [props.actions] usually one or more <Button>
 */
export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  className,
}) {
  return (
    <header className={cn('flex flex-col gap-3 pb-4', className)}>
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                  {/* The last crumb is the current page, so it is not a link. */}
                  {isLast ? (
                    <span aria-current="page" className="text-text">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="rounded-sm hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {description && (
            <p className="text-sm text-text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
