/**
 * Sidebar — owned by A.
 *
 * Nav entries come from the module registry, never a hardcoded list. Each
 * module exports its own `<noun>Nav` and A's registry collects them, so adding
 * a module to the sidebar is zero work here.
 *
 * Two behaviours in one component, split by breakpoint:
 *  - md and up: an in-flow column that collapses to icon-only
 *  - below md:  an overlay drawer over the content, closed by default
 */

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { moduleNav } from '@/app/registry';
import { Can } from '@/lib/auth';
import { cn } from '@/lib/cn';

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  return (
    <>
      {/* Backdrop, mobile only. A button so Escape/Enter and screen readers work. */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <nav
        aria-label="Main"
        className={cn(
          'flex flex-col border-r border-border bg-surface',
          // Mobile: fixed drawer, slid out of view unless open.
          'fixed inset-y-0 left-0 z-40 w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back in the flow, always visible, width driven by collapse.
          'md:static md:shrink-0 md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-60',
          // The global prefers-reduced-motion rule in styles/tailwind.css
          // already neutralises this; motion-reduce is belt and braces.
          'transition-[width,transform] duration-200 motion-reduce:transition-none',
        )}
      >
        <ProductName collapsed={collapsed} />

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {moduleNav.map((item) => (
            // Hides the entry. Does not secure the route — the server must
            // reject the request too. docs/security-notes.md §2.
            <Can key={item.path} permission={item.permission}>
              <li>
                <NavItem
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                />
              </li>
            </Can>
          ))}
        </ul>

        {/* Collapse is a desktop affordance; on mobile the drawer just closes. */}
        <div className="hidden border-t border-border p-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-text-muted hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {collapsed ? (
              <PanelLeftOpen size={16} className="shrink-0" />
            ) : (
              <PanelLeftClose size={16} className="shrink-0" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

function ProductName({ collapsed }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-fg"
      >
        E
      </span>
      {/* sr-only rather than removed, so the name stays in the accessibility
          tree and the width transition has nothing to reflow. */}
      <span className={cn('font-semibold text-text', collapsed && 'sr-only')}>
        ERP
      </span>
    </div>
  );
}

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      // Closes the drawer on mobile; a no-op on desktop.
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2 rounded-md px-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary text-primary-fg'
            : 'text-text-muted hover:bg-bg hover:text-text',
        )
      }
    >
      {Icon && <Icon size={16} className="shrink-0" />}
      <span className={cn('truncate', collapsed && 'sr-only')}>
        {item.label}
      </span>
    </NavLink>
  );
}
