/**
 * User menu — owned by A.
 *
 * Reads the current user from AuthProvider. Until week 2 that user is a stub
 * set in src/app/providers.jsx; nothing here changes when real auth lands.
 */

import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

/** "Demo Admin" → "DA". Falls back to the email's first letter. */
function initialsFor(user) {
  const first = user?.firstName?.[0] ?? '';
  const last = user?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
}

export function UserMenu() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  const logout = () => {
    setOpen(false);
    // TODO(A), week 2: also POST /auth/logout so the server invalidates the
    // refresh token. Clearing client state alone is not a logout —
    // docs/security-notes.md § Token handling.
    setUser(null);
    navigate('/login');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm text-text hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg"
        >
          {initialsFor(user)}
        </span>
        {/* The name is decoration next to the avatar on narrow screens. */}
        <span className="hidden sm:inline">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-48 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-text">{name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text',
              'hover:bg-bg focus-visible:bg-bg focus-visible:outline-none',
            )}
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
