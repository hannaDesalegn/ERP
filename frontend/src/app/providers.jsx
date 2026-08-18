/**
 * App providers — owned by A.
 *
 * One place so no module ever wires a provider of its own. There is exactly one
 * AuthProvider in the app and it is here; a second one anywhere shadows this
 * tree's user and silently changes what <Can> lets through.
 *
 * Still to come: ErrorBoundary.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from '@/auth/AuthContext';
import { Toaster } from '@/components/ui/toast';

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

  // AuthProvider sits inside QueryClientProvider so the login mutation and any
  // future auth query have a client to use.
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {/* Mounted once, here. Modules just call toast.success(...) and never
            wire anything up themselves. */}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
