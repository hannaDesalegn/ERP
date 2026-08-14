/**
 * Topbar — owned by A.
 *
 * Never scrolls. Breadcrumbs left, search in the middle, user menu right.
 */

import { Menu, Search } from 'lucide-react';

import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';

export function Topbar({ onOpenSidebar }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      {/* Opens the drawer. Hidden once the sidebar is always visible. */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="rounded-md p-1.5 text-text-muted hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
      >
        <Menu size={18} />
      </button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-3">
        <SearchPlaceholder />
        <UserMenu />
      </div>
    </header>
  );
}

/**
 * Global search — deliberately disabled, and a post-backend item.
 *
 * This is not a frontend task waiting on frontend work. Searching "acme" here
 * has to return customers, orders, invoices, products, suppliers and purchase
 * orders in one ranked list, which means a single endpoint that spans every
 * module and scopes results to what the user may see. Nothing in MSW can fake
 * that usefully — per-module mock arrays would give a result set that looks
 * right and ranks wrong, and we would build the UI against the wrong shape.
 *
 * So it stays disabled until the backend exists. Disabled rather than removed
 * because the affordance is part of the layout, and an input that accepts text
 * and then does nothing reads as broken where a disabled one reads as "not yet".
 *
 * TODO: needs GET /api/search?q= spanning all modules. Not scheduled — it is
 * blocked on the backend, not on us. Listed in README § Known gaps.
 */
function SearchPlaceholder() {
  return (
    <div className="relative hidden md:block">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        disabled
        aria-label="Search"
        placeholder="Global search — coming soon"
        className="h-9 w-64 rounded-md border border-border bg-bg pl-7 pr-2 text-sm text-text placeholder:text-text-muted disabled:cursor-not-allowed"
      />
    </div>
  );
}
