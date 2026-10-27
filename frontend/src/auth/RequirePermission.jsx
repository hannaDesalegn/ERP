/**
 * Permission guard. Hides UI; the server still enforces access.
 *
 * Same contract as RequireRole, keyed on a permission string instead of a
 * role slug, so a page follows the same rule as its endpoint.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ForbiddenPage } from '@/pages/ForbiddenPage';

import { useAuth } from './AuthContext';

export function RequirePermission({ permission, children }) {
  const { user, can } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!can(permission)) return <ForbiddenPage />;

  return children ?? <Outlet />;
}
