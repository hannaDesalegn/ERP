/**
 * Route tree — owned by A.
 *
 * Everything renders inside AppShell, including 403 and 404 — losing the nav
 * when you hit a bad URL leaves the user stranded.
 *
 * TODO(A), week 2: wrap the shell in ProtectedRoute, and add /login outside it.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@/layouts/AppShell';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { KitchenSinkPage } from '@/pages/KitchenSinkPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { moduleRoutes } from './registry';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
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
