/**
 * ApiClientProvider — exposes a typed `ApiClient` keyed off the current
 * settings (apiBaseUrl) and keychain-stored API key. Recreates when either
 * changes.
 *
 * Usage in screens (J1.10):
 *   const api = useApi();
 *   const { data } = await api.GET('/jobs');
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from '@universal-downloader/api-client';

import { useSettings } from './settings-store';
import { getApiKey } from './keychain';

interface ApiContextValue {
  client: ApiClient;
  apiBaseUrl: string;
  hasApiKey: boolean;
  reloadApiKey: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiClientProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const apiBaseUrl = useSettings((s) => s.apiBaseUrl);
  const [apiKey, setApiKeyState] = useState<string>('');

  const reloadApiKey = async (): Promise<void> => {
    const k = await getApiKey();
    setApiKeyState(k ?? '');
  };

  useEffect(() => {
    void reloadApiKey();
  }, []);

  const value = useMemo<ApiContextValue>(() => {
    const client = createApiClient({ baseUrl: apiBaseUrl, apiKey });
    return {
      client,
      apiBaseUrl,
      hasApiKey: apiKey.length > 0,
      reloadApiKey,
    };
  }, [apiBaseUrl, apiKey]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApiContext must be used within <ApiClientProvider>');
  return ctx;
}

export function useApi(): ApiClient {
  return useApiContext().client;
}
