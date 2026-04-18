/**
 * Renders a friendly nudge to set the API key when none is configured.
 * Wrap protected routes with this in J1.6:
 *
 *   <ApiKeyGate><JobsList /></ApiKeyGate>
 */
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { KeyRound } from 'lucide-react';
import { useApi } from '@/lib/api-context';

export function ApiKeyGate({ children }: { children: ReactNode }): JSX.Element {
  const { hasKey } = useApi();
  if (hasKey) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6 text-center">
      <KeyRound className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden />
      <h2 className="text-lg font-semibold">API key required</h2>
      <p className="mt-1 text-sm text-muted">
        Universal Downloader needs an API key to talk to your backend. Add one
        on the Settings page to get started.
      </p>
      <Link
        to="/settings"
        className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Open Settings
      </Link>
    </div>
  );
}
