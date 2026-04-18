import { useMemo, type ReactNode } from 'react';
import { ApiContext, buildApi } from './local-api';
import { useSettings } from './settings-store';

export interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps): JSX.Element {
  const apiBaseUrl = useSettings((s) => s.apiBaseUrl);
  const apiKey = useSettings((s) => s.apiKey);
  const useLocal = useSettings((s) => s.useLocalSidecars);

  const client = useMemo(
    () => buildApi({ useLocal, apiBaseUrl, apiKey }),
    [useLocal, apiBaseUrl, apiKey],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}
