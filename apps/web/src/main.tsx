/**
 * Entry point. Wires React Query, the API client provider, and the router.
 *
 * Provider order (outer -> inner):
 *   QueryClientProvider -> ApiClientProvider -> RouterProvider
 *
 * That order ensures hooks in routes can call both `useQueryClient()` and
 * `useApi()` freely.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ApiClientProvider } from '@/lib/api-context';
import { applyTheme } from '@/lib/theme';
import { useSettings } from '@/lib/settings-store';
import { router } from './router';
import './styles/globals.css';

// Apply the persisted theme as early as possible to avoid a flash.
applyTheme(useSettings.getState().theme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider>
        <RouterProvider router={router} />
      </ApiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
