import { useSettings } from '@/lib/settings-store';

export function SettingsScreen(): JSX.Element {
  const s = useSettings();
  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.useLocalSidecars}
          onChange={(e) => s.setUseLocalSidecars(e.target.checked)}
        />
        <span>Use local sidecars (yt-dlp / ffmpeg)</span>
      </label>

      <label className="block">
        <span className="block text-sm text-muted">Remote API base URL</span>
        <input
          className="mt-1 w-full rounded border border-border bg-bg px-2 py-1"
          value={s.apiBaseUrl}
          onChange={(e) => s.setApiBaseUrl(e.target.value)}
          disabled={s.useLocalSidecars}
        />
      </label>

      <label className="block">
        <span className="block text-sm text-muted">API key</span>
        <input
          className="mt-1 w-full rounded border border-border bg-bg px-2 py-1"
          type="password"
          value={s.apiKey}
          onChange={(e) => s.setApiKey(e.target.value)}
          disabled={s.useLocalSidecars}
        />
      </label>

      <label className="block">
        <span className="block text-sm text-muted">Download folder</span>
        <input
          className="mt-1 w-full rounded border border-border bg-bg px-2 py-1"
          value={s.downloadFolder}
          onChange={(e) => s.setDownloadFolder(e.target.value)}
        />
      </label>
    </div>
  );
}
