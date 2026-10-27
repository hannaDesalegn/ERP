/**
 * Auth state.
 *
 * The access token lives in React state here and nowhere else: not
 * localStorage, not sessionStorage, not a readable cookie. All three are
 * reachable by injected script, which turns a single XSS into a permanent
 * account takeover. docs/security-notes.md § Token handling, and
 * docs/api-contract.md §3, where this is written down as a decision rather
 * than a preference.
 *
 * The cost is real and intended: a page refresh loses the token and lands you
 * back on /login. The fix for that is not to persist the token — it is
 * POST /auth/refresh against an httpOnly cookie on boot, which is week-2 work
 * and the reason `isLoading` already exists on this context.
 *
 * > Everything here shapes the UI. None of it secures anything. The server
 * > must independently enforce every permission — docs/security-notes.md §2.
 * > Someone who controls their own browser can always edit what it renders;
 * > what they cannot do is make the API answer, and every endpoint checks.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiClient, setAccessToken } from '@/lib/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  /**
   * There is no boot restore in the mock phase. The token is in React state,
   * so a fresh page load starts with none, and there is nothing to hand
   * /auth/me. This stays on the context because ProtectedRoute branches on it
   * and because the real boot sequence — /auth/refresh, then /auth/me — makes
   * it true again without changing a single consumer.
   */
  const isLoading = false;

  // apiClient holds the token outside React so it can attach the Authorization
  // header from any call site. React state stays the source of truth; this
  // pushes it down whenever it changes, including back to null on logout.
  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  /**
   * Throws ApiError on a bad credential — 401 with the server's message. The
   * caller decides how to show it; this does not toast or navigate.
   *
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<object>} the signed-in user
   */
  const login = useCallback(async ({ email, password }) => {
    // api-contract.md §3: { data: { user, accessToken } }. apiClient hands back
    // the envelope untouched — other callers rely on that — so unwrap here.
    const { data } = await apiClient.post('/auth/login', { email, password });

    // The login body is used for the token only. Who the user is and what
    // they may do comes from GET /auth/me, the dedicated endpoint the server
    // answers from the stored account (pentest vuln-3). The token is pushed
    // to apiClient directly because the state effect above has not run yet.
    setAccessToken(data.accessToken);
    let me;
    try {
      ({ data: me } = await apiClient.get('/auth/me'));
    } catch (error) {
      setAccessToken(null);
      throw error;
    }

    setToken(data.accessToken);
    setUser(me);
    return me;
  }, []);

  /**
   * Swaps in a token the server issued mid-session. A password change revokes
   * every older token, the caller's included, and returns a fresh one.
   *
   * @param {string} nextToken
   */
  const replaceToken = useCallback((nextToken) => {
    setAccessToken(nextToken);
    setToken(nextToken);
  }, []);

  /**
   * Clears client state and tells the server to invalidate the session.
   *
   * Client state is cleared even if the request fails: a user who clicked
   * "Log out" must end up logged out of this browser regardless of what the
   * network did. docs/security-notes.md § Token handling.
   */
  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Deliberately swallowed — see above.
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => {
    const permissions = user?.permissions ?? [];
    return {
      user,
      isLoading,
      login,
      logout,
      replaceToken,
      permissions,
      /** @param {string} permission @returns {boolean} */
      can: (permission) => !permission || permissions.includes(permission),
    };
  }, [user, isLoading, login, logout, replaceToken]);

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
