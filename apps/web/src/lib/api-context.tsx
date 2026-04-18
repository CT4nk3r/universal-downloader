/**
 * `<ApiClientProvider>` exposes a memoized `ApiClient` and the raw connection
 * options (needed for SSE subscriptions) via React context.
 *
 * Consumers (J1.6 screens):
 *   const { client, options } = useApi();
 *   useJobs(client);
 *   useJobEvents(options, jobId);
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ApiClient } from '@universal-downloader/api-client';
import { buildApiClient } from './api';
import { useSettings } from './settings-store';

export interface ApiContextValue {
  client: ApiClient;
  options: { baseUrl: string; apiKey: string };
  hasKey: boolean;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiClientProvider({ children }: { children: ReactNode }): JSX.Element {
  const apiBaseUrl = useSettings((s) => s.apiBaseUrl);
  const apiKey = useSettings((s) => s.apiKey);

  const value = useMemo<ApiContextValue>(() => {
    const options = { baseUrl: apiBaseUrl, apiKey };
    return {
      client: buildApiClient(options),
      options,
      hasKey: apiKey.trim().length > 0,
    };
  }, [apiBaseUrl, apiKey]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi() must be used inside <ApiClientProvider>');
  return ctx;
}
