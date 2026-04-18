import { useSettings } from '@/lib/settings-store';

export function HomeScreen(): JSX.Element {
  const useLocal = useSettings((s) => s.useLocalSidecars);
  const downloadFolder = useSettings((s) => s.downloadFolder);
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Hello, sidecar mode = {String(useLocal)}</h2>
      <p className="text-sm text-muted">
        This is the Universal Downloader desktop shell (J1.7). Real screens
        will be ported from <code>apps/web</code> in a follow-up job.
      </p>
      <p className="text-sm">
        Download folder: <code className="font-mono">{downloadFolder}</code>
      </p>
    </div>
  );
}
