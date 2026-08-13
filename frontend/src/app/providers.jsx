/**
 * App providers — owned by A.
 *
 * QueryClient, Router, AuthProvider, Toaster, ErrorBoundary. One place so no
 * module ever wires a provider of its own.
 */

// TODO(A): build the provider stack.
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }) {
  return children;
}
