/**
 * Runtime API selection: remote HTTP client vs. local Tauri-sidecar adapter.
 *
 * The local adapter (`createSidecarClient`, J1.8) MUST implement the same
 * `ApiClient` surface returned by `@universal-downloader/api-client`'s
 * `createApiClient`, so consumers can use either interchangeably.
 *
 * Selection is driven by `useSettings().useLocalSidecars`. We re-evaluate
 * (and rebuild the client) whenever any of the inputs change, then memoize
 * it so React Query keeps a stable reference between renders.
 *
 * Pure-TS module (no JSX) so it can keep the `.ts` extension; the React
 * provider component lives in `./api-provider.tsx`.
 */
import { useContext, createContext } from 'react';
import {
  createApiClient,
  type ApiClient,
} from '@universal-downloader/api-client';
import { createSidecarClient } from './sidecar-client';

export interface ApiSelectionInput {
  useLocal: boolean;
  apiBaseUrl: string;
  apiKey: string;
}

/**
 * Build an `ApiClient` from the current settings snapshot. Pure function so
 * it can be safely memoized at the provider level.
 */
export function buildApi(input: ApiSelectionInput): ApiClient {
  if (input.useLocal) {
    return createSidecarClient();
  }
  return createApiClient({ baseUrl: input.apiBaseUrl, apiKey: input.apiKey });
}

export const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error('useApi() must be used inside <ApiProvider>');
  }
  return ctx;
}
