/**
 * Route tree.
 *
 * Every signed-in page renders inside AppShell, including 403 and 404 — losing
 * the nav when you hit a bad URL leaves the user stranded. /login is the one
 * exception: it is a full-viewport screen with its own layout, so it sits
 * outside the shell rather than inside it with the chrome hidden.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { RequirePermission } from '@/auth/RequirePermission';
import { RequireRole } from '@/auth/RequireRole';
import { AppShell } from '@/layouts/AppShell';
import { AccountPage } from '@/pages/AccountPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { KitchenSinkPage } from '@/pages/KitchenSinkPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { UsersPage } from '@/pages/UsersPage';

import { moduleRoutes } from './registry';

export const router = createBrowserRouter([
  // Outside the shell, deliberately. Must stay above the shell route.
  { path: '/login', element: <LoginPage /> },

  {
    // Everything below this line requires a signed-in user. 403 and 404 sit
    // inside it deliberately — losing the nav on a bad URL strands the user.
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // A top-level page, so it sits here rather than coming from the registry.
      { path: '/dashboard', element: <DashboardPage /> },

      // Admin only. RequireRole renders ForbiddenPage in place rather than
      // redirecting, so the URL still shows what was refused.
      {
        path: '/users',
        element: (
          <RequireRole roles={['admin']}>
            <UsersPage />
          </RequireRole>
        ),
      },

      // Company settings follow their endpoint: settings.view, admin only.
      {
        path: '/settings',
        element: (
          <RequirePermission permission="settings.view">
            <SettingsPage />
          </RequirePermission>
        ),
      },

      // The signed-in user's own account. Everyone has a password to change,
      // and the endpoint behind it acts only on the caller's own account.
      { path: '/account', element: <AccountPage /> },

      // Every module's routes, collected by the registry.
      ...moduleRoutes,

      { path: '/403', element: <ForbiddenPage /> },

      // Component kit reference page — a development aid, not a product page.
      { path: '/kitchen-sink', element: <KitchenSinkPage /> },

      // Catch-all. Must stay last.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
