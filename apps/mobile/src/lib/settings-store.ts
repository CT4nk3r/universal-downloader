/**
 * Persistent settings store (Zustand + MMKV).
 *
 * NOTE: `apiKey` is intentionally NOT stored here — it lives in the OS keychain
 * (see `./keychain.ts`). MMKV holds non-secret prefs only.
 */
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';
export type DownloadPreset = 'audio-mp3' | 'audio-flac' | 'video-1080p' | 'video-best';

export interface SettingsState {
  apiBaseUrl: string;
  defaultPreset: DownloadPreset;
  theme: ThemePreference;
  setApiBaseUrl: (url: string) => void;
  setDefaultPreset: (preset: DownloadPreset) => void;
  setTheme: (theme: ThemePreference) => void;
}

const defaultBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787/v1',
  ios: 'http://localhost:8787/v1',
  default: 'http://localhost:8787/v1',
});

const storage = new MMKV({ id: 'universal-downloader-settings' });

const mmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiBaseUrl: defaultBaseUrl,
      defaultPreset: 'audio-mp3',
      theme: 'system',
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setDefaultPreset: (defaultPreset) => set({ defaultPreset }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
    },
  ),
);
