/**
 * App providers — owned by A.
 *
 * One place so no module ever wires a provider of its own.
 * Still to come: Toaster, ErrorBoundary.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Toaster } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth';

/**
 * TEMPORARY stub user — delete in week 2.
 *
 * Real auth boots by calling /auth/refresh then /auth/me. Until that exists,
 * the shell needs someone to be signed in or every nav entry is filtered out by
 * <Can> and the app looks empty. Matches admin@example-erp.test from the README.
 */
const STUB_USER = {
  id: 'usr_0001',
  email: 'admin@example-erp.test',
  firstName: 'Demo',
  lastName: 'Admin',
  avatarUrl: null,
  roleId: 'rol_0001',
  roleName: 'Administrator',
  permissions: [
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.delete',
    'orders.view',
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.approve',
    'invoices.view',
    'invoices.create',
    'invoices.edit',
    'invoices.void',
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'products.adjust_stock',
    'suppliers.view',
    'suppliers.create',
    'suppliers.edit',
    'suppliers.delete',
    'purchasing.view',
    'purchasing.create',
    'purchasing.edit',
    'purchasing.approve',
    'purchasing.receive',
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'settings.view',
    'settings.edit',
  ],
  status: 'active',
};

export function Providers({ children }) {
  // Created once per app instance, not once per render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={STUB_USER}>
        {children}
        {/* Mounted once, here. Modules just call toast.success(...) and never
            wire anything up themselves. */}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
