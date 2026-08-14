/**
 * Route tree — owned by A.
 *
 * v0 only carries the temporary kitchen-sink page. The real tree (AppShell,
 * ProtectedRoute, module routes from the registry, 404/403) is week-2 work.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';

import { KitchenSinkPage } from '@/pages/KitchenSinkPage';

import { moduleRoutes } from './registry';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/kitchen-sink" replace /> },

  // TEMPORARY — delete along with the page before the demo.
  { path: '/kitchen-sink', element: <KitchenSinkPage /> },

  ...moduleRoutes,
]);
