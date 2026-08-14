import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { Providers } from '@/app/providers';
import { router } from '@/app/router';

import './styles/tailwind.css';

// TODO(A): start MSW here when VITE_USE_MOCKS=true, before the first render.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
