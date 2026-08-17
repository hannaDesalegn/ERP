/**
 * Role guard — owned by A. Hides UI; the server still enforces access.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ForbiddenPage } from '@/pages/ForbiddenPage';

import { useAuth } from './AuthContext';

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  // Not signed in is a login problem, not a permissions one.
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // roleId holds the slug ('admin'); roleName holds the label.
  // Rendered in place, not redirected, so the URL still shows what was refused.
  if (!roles.includes(user.roleId)) return <ForbiddenPage />;

  return children ?? <Outlet />;
}
