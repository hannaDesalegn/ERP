import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tailwind.css';

// TODO(A): once src/app/providers.jsx and src/app/router.jsx are built,
// this becomes `<Providers><RouterProvider router={router} /></Providers>`.
// MSW is started here first when VITE_USE_MOCKS=true — see src/mocks/browser.js.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <main className="grid min-h-screen place-items-center p-8">
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-text">ERP frontend</h1>
        <p className="mt-2 text-sm text-text-muted">
          Scaffold is running. Nothing is built yet.
        </p>
      </div>
    </main>
  </StrictMode>,
);
