import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { Providers } from '@/app/providers';
import { router } from '@/app/router';

import './styles/tailwind.css';

/**
 * Start MSW before the first render, so no component can fire a request at a
 * network that isn't intercepted yet.
 *
 * The dynamic import keeps msw and every module's mock data out of the
 * production bundle when mocks are off.
 */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  const { worker } = await import('./mocks/browser');
  await worker.start({
    // Let Vite's own asset and HMR requests through untouched.
    onUnhandledRequest: 'bypass',
  });
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
