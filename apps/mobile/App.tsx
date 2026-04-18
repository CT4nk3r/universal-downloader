/**
 * Universal Downloader by CT4nk3r — root component.
 *
 * Wires the providers expected by every screen (J1.10):
 *   - SafeAreaProvider
 *   - QueryClientProvider (TanStack Query)
 *   - ApiClientProvider (typed openapi-fetch client + base URL/api key)
 *   - NavigationContainer + RootTabs
 */
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApiClientProvider } from './src/lib/api-context';
import { RootTabs } from './src/navigation';
import { navigationTheme } from './src/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App(): React.JSX.Element {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider>
          <NavigationContainer theme={navigationTheme(isDark)}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <RootTabs />
          </NavigationContainer>
        </ApiClientProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
