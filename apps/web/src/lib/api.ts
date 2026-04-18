/**
 * Builds an `ApiClient` from current settings. Memoize at the provider level.
 */
import { createApiClient, type ApiClient } from '@universal-downloader/api-client';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export function buildApiClient(config: ApiConfig): ApiClient {
  return createApiClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  });
}
