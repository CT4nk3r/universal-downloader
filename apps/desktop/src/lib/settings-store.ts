/**
 * Persistent app settings for the desktop shell.
 *
 * Mirrors the shape of `apps/web/src/lib/settings-store.ts` and adds two
 * desktop-only fields:
 *   - `useLocalSidecars`: when true, route API calls to the in-process Tauri
 *     sidecar adapter (J1.8); when false, hit the remote `apiBaseUrl`.
 *   - `downloadFolder`: default destination for downloads. Resolved by the
 *     Rust side; the literal default below is just a UI placeholder until
 *     `pick_download_folder` (or first run) sets the real path.
 *
 * Persisted under the `ud-desktop-settings` key (separate from the web key
 * so a user can run both apps side-by-side without conflicts).
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
  useLocalSidecars: boolean;
  downloadFolder: string;
  setApiBaseUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  setDefaultPreset: (v: Preset) => void;
  setTheme: (v: Theme) => void;
  setConcurrentLimit: (v: number) => void;
  setUseLocalSidecars: (v: boolean) => void;
  setDownloadFolder: (v: string) => void;
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
  useLocalSidecars: true,
  // Placeholder; the Rust side resolves the real OS download dir on first run.
  downloadFolder: '~/Downloads/Universal Downloader/',
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
      setUseLocalSidecars: (useLocalSidecars) => set({ useLocalSidecars }),
      setDownloadFolder: (downloadFolder) => set({ downloadFolder }),
      reset: () => set({ ...defaults }),
    }),
    {
      name: 'ud-desktop-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        apiBaseUrl: s.apiBaseUrl,
        apiKey: s.apiKey,
        defaultPreset: s.defaultPreset,
        theme: s.theme,
        concurrentLimit: s.concurrentLimit,
        useLocalSidecars: s.useLocalSidecars,
        downloadFolder: s.downloadFolder,
      }),
    },
  ),
);
