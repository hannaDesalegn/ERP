/**
 * Route guard — owned by A. Hides UI; the server still enforces access.
 */

import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // The kit has no shared loader; this is Button's spinner idiom.
  if (isLoading) {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <Loader2
          size={20}
          aria-label="Loading"
          className="animate-spin text-text-muted"
        />
      </div>
    );
  }

  // `from` is where the login form sends the user once they are in.
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Works wrapped around an element or as a layout route.
  return children ?? <Outlet />;
}
