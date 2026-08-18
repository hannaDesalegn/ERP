/**
 * User menu — owned by A.
 *
 * Reads the signed-in user from AuthProvider and owns the only Log out control
 * in the app.
 */

import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';

/** "Meron Alemu" → "MA". Falls back to the email's first letter. */
function initialsFor(user) {
  const first = user?.firstName?.[0] ?? '';
  const last = user?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
}

export function UserMenu() {
  const { user, logout } = useAuth();
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

  // logout() clears client state even if the request fails, so this always
  // ends up at /login. replace so Back doesn't return to the signed-in shell.
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
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
            {/* roleName is the label; roleId holds the slug the guards match. */}
            <p className="mt-0.5 text-xs text-text-muted">{user.roleName}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
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
