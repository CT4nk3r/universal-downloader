/**
 * Persistent app settings (zustand + localStorage).
 *
 * Persisted under the `ud-settings` key. Consumed by:
 *   - `<ApiClientProvider>` to construct the API client
 *   - the Settings screen (J1.6) to edit values
 *   - `theme.ts` to apply the chosen theme on boot/change
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type Preset = 'best' | 'audio' | 'video-1080p' | 'video-720p';

export interface SettingsState {
  apiBaseUrl: string;
  apiKey: string;
  defaultPreset: Preset;
  theme: Theme;
  concurrentLimit: number;
  setApiBaseUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  setDefaultPreset: (v: Preset) => void;
  setTheme: (v: Theme) => void;
  setConcurrentLimit: (v: number) => void;
  reset: () => void;
}

const DEFAULT_API_URL =
  (import.meta.env.VITE_DEFAULT_API_URL as string | undefined) ??
  'http://localhost:8787/v1';

const defaults = {
  apiBaseUrl: DEFAULT_API_URL,
  apiKey: '',
  defaultPreset: 'best' as Preset,
  theme: 'system' as Theme,
  concurrentLimit: 3,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setApiKey: (apiKey) => set({ apiKey }),
      setDefaultPreset: (defaultPreset) => set({ defaultPreset }),
      setTheme: (theme) => set({ theme }),
      setConcurrentLimit: (concurrentLimit) => set({ concurrentLimit }),
      reset: () => set({ ...defaults }),
    }),
    {
      name: 'ud-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        apiBaseUrl: s.apiBaseUrl,
        apiKey: s.apiKey,
        defaultPreset: s.defaultPreset,
        theme: s.theme,
        concurrentLimit: s.concurrentLimit,
      }),
    },
  ),
);
