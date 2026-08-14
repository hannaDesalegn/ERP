/**
 * Auth + permissions — owned by A.
 *
 * v0 scope: just enough for the kit to work. The real AuthProvider (login,
 * in-memory access token, /auth/refresh on boot, idle timeout) is week 2 —
 * see docs/api-contract.md §3.
 *
 * > `<Can>` hides UI. It secures nothing. Any user can open devtools and call
 * > the API directly. Every permission here needs a matching server-side check.
 * > See docs/security-notes.md §2.
 */

import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

/**
 * @param {{ children: React.ReactNode, initialUser?: import('react').ReactNode }} props
 */
export function AuthProvider({ children, initialUser = null }) {
  // TODO(A): replace with the real boot sequence — /auth/refresh then /auth/me.
  const [user, setUser] = useState(initialUser);

  const value = useMemo(() => {
    const permissions = user?.permissions ?? [];
    return {
      user,
      setUser,
      permissions,
      /** @param {string} permission @returns {boolean} */
      can: (permission) => !permission || permissions.includes(permission),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

/**
 * @param {string} permission
 * @returns {boolean}
 */
export function useCan(permission) {
  return useAuth().can(permission);
}

/**
 * Renders children only when the user holds the permission.
 * Hides UI. Secures nothing.
 *
 * @param {{ permission: string, children: React.ReactNode, fallback?: React.ReactNode }} props
 */
export function Can({ permission, children, fallback = null }) {
  return useCan(permission) ? children : fallback;
}
