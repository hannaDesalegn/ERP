/**
 * Route tree — owned by A.
 *
 * Every signed-in page renders inside AppShell, including 403 and 404 — losing
 * the nav when you hit a bad URL leaves the user stranded. /login is the one
 * exception: it is a full-viewport screen with its own layout, so it sits
 * outside the shell rather than inside it with the chrome hidden.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppShell } from '@/layouts/AppShell';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { KitchenSinkPage } from '@/pages/KitchenSinkPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

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
      // TODO(A), week 3: point this at /dashboard once that page exists.
      { index: true, element: <Navigate to="/customers" replace /> },

      // Every module's routes, collected by the registry.
      ...moduleRoutes,

      { path: '/403', element: <ForbiddenPage /> },

      // TEMPORARY — delete along with the page before the demo.
      { path: '/kitchen-sink', element: <KitchenSinkPage /> },

      // Catch-all. Must stay last.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
