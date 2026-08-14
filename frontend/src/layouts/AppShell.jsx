/**
 * App shell — owned by A.
 *
 * The layout every signed-in page renders inside. The whole point is that the
 * sidebar and topbar never move: in a dense app, chrome that shifts while you
 * work is disorienting. So the outer element is exactly one viewport tall with
 * overflow hidden, and the only scrollable thing is <main>.
 *
 *   ┌──────────┬──────────────────────────┐
 *   │          │ Topbar        (fixed)    │
 *   │ Sidebar  ├──────────────────────────┤
 *   │ (fixed)  │ main          (scrolls)  │
 *   └──────────┴──────────────────────────┘
 */

import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useScrollRestoration } from './useScrollRestoration';

export function AppShell() {
  // Collapsed state is deliberately React state, not localStorage: it resets
  // per session and nothing outside this tree needs to know about it.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const contentRef = useRef(null);
  useScrollRestoration(contentRef);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Keyboard users should not have to tab the whole nav on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-primary"
      >
        Skip to content
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* min-w-0 stops a wide table inside main from pushing the layout out. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />

        <main id="main" ref={contentRef} className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
