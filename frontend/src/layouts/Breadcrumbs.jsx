/**
 * Topbar breadcrumbs — owned by A.
 *
 * Derived from the URL rather than passed in by each page, so a page cannot
 * forget to set them and no two pages disagree about what the trail looks like.
 * Labels come from the module registry where a segment matches a nav path;
 * everything else is humanised, except ids, which are shown raw.
 */

import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { moduleNav } from '@/app/registry';

/** A's own pages are not modules, so their labels live here. */
const STATIC_LABELS = {
  '/settings': 'Settings',
  '/users': 'Users',
  '/kitchen-sink': 'Kitchen sink',
  '/403': 'Not allowed',
};

/** "purchase-orders" → "Purchase orders". Ids like cus_0001 are left alone. */
function humanise(segment) {
  if (/[_\d]/.test(segment)) return segment;
  const spaced = segment.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function buildCrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const navLabels = new Map(moduleNav.map((item) => [item.path, item.label]));

  return segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    return {
      path,
      label: navLabels.get(path) ?? STATIC_LABELS[path] ?? humanise(segment),
    };
  });
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-text-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={crumb.path} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="shrink-0"
                />
              )}
              {/* The last crumb is the current page, so it is text, not a link. */}
              {isLast ? (
                <span aria-current="page" className="truncate text-text">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="truncate rounded-sm hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
