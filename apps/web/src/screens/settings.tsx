import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Plug } from 'lucide-react';
import { useApi } from '@/lib/api-context';
import { useSettingsStore, type Theme } from '@/lib/settings-store';
import { useHealth } from '@universal-downloader/api-client/hooks';
import type { QualityPreset } from '@universal-downloader/shared-types';

const PRESETS: ReadonlyArray<{ id: QualityPreset; label: string }> = [
  { id: 'best', label: 'Best' },
  { id: 'p2160', label: '2160p (4K)' },
  { id: 'p1440', label: '1440p (2K)' },
  { id: 'p1080', label: '1080p' },
  { id: 'p720', label: '720p' },
  { id: 'p480', label: '480p' },
  { id: 'audio_mp3', label: 'Audio MP3' },
  { id: 'audio_m4a', label: 'Audio M4A' },
];

const THEMES: ReadonlyArray<{ id: Theme; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function SettingsScreen(): JSX.Element {
  const { client } = useApi();
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const setApiBaseUrl = useSettingsStore((s) => s.setApiBaseUrl);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const defaultPreset = useSettingsStore((s) => s.defaultPreset);
  const setDefaultPreset = useSettingsStore((s) => s.setDefaultPreset);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const concurrentLimit = useSettingsStore((s) => s.concurrentLimit);
  const setConcurrentLimit = useSettingsStore((s) => s.setConcurrentLimit);

  const [showKey, setShowKey] = useState(false);
  const health = useHealth(client, { enabled: false });

  const testConnection = () => {
    void health.refetch();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="text-sm text-zinc-500">Configure your API connection and download defaults.</p>
      </header>

      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">API connection</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">API base URL</span>
          <input
            type="url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="http://localhost:8787/v1"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">API key</span>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              autoComplete="off"
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-10 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:hover:bg-zinc-800"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={testConnection}
            disabled={health.isFetching}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {health.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plug className="h-4 w-4" aria-hidden="true" />
            )}
            Test connection
          </button>
          <div className="text-sm" role="status" aria-live="polite">
            {health.isFetching && <span className="text-zinc-500">Checking…</span>}
            {!health.isFetching && health.isSuccess && (
              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Connected
              </span>
            )}
            {!health.isFetching && health.isError && (
              <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {health.error instanceof Error ? health.error.message : 'Connection failed'}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Download defaults</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Default preset</span>
          <select
            value={defaultPreset}
            onChange={(e) => setDefaultPreset(e.target.value as QualityPreset)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="block text-sm">
          <label htmlFor="concurrent-limit" className="mb-1 block font-medium">
            Concurrent downloads: {concurrentLimit}
          </label>
          <input
            id="concurrent-limit"
            type="range"
            min={1}
            max={8}
            step={1}
            value={concurrentLimit}
            onChange={(e) => setConcurrentLimit(Number(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>1</span>
            <span>8</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Appearance</h2>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">Theme</legend>
          <div role="radiogroup" aria-label="Theme" className="flex gap-2">
            {THEMES.map((t) => {
              const selected = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(t.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <footer className="pt-4 text-center text-xs text-zinc-500">
        Universal Downloader by CT4nk3r
      </footer>
    </div>
  );
}
