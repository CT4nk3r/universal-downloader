import { useEffect, useState } from 'react';
import type { ApiClientOptions } from '@universal-downloader/api-client';
import { useApiContext } from '../lib/api-context';
import { getApiKey } from '../lib/keychain';

/**
 * Returns the live `ApiClientOptions` (baseUrl + bearer key) used for raw
 * fetch operations like SSE that bypass the typed client. Keychain is read
 * once on mount; the tuple is stable for hook deps.
 */
export function useApiOptions(): ApiClientOptions {
  const { apiBaseUrl } = useApiContext();
  const [apiKey, setApiKey] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    void getApiKey().then((k) => {
      if (!cancelled) setApiKey(k ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { baseUrl: apiBaseUrl, apiKey };
}
