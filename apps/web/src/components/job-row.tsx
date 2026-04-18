import { useEffect, useMemo, useState } from 'react';
import { Trash2, X, FileVideo, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/api-context';
import { useDeleteJob, useJobEvents } from '@universal-downloader/api-client/hooks';
import { SiteBadge } from './site-badge';
import { formatBytes } from './format-bytes';
import { formatSpeed } from './format-speed';
import { formatDuration } from './format-duration';
import type { UiJob, UiJobEvent, UiJobProgress } from './types';

interface JobRowProps {
  job: UiJob;
  /** When false, skip live SSE subscription (e.g. terminal jobs in History). */
  live?: boolean;
}

const TERMINAL: ReadonlySet<string> = new Set(['ready', 'failed', 'cancelled', 'expired']);

function StatusIcon({ status }: { status: string }): JSX.Element {
  if (status === 'ready') return <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />;
  if (status === 'failed') return <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />;
  if (status === 'cancelled' || status === 'expired')
    return <X className="h-4 w-4 text-zinc-500" aria-hidden="true" />;
  return <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />;
}

// TODO: replace with @universal-downloader/ui ListItem
export function JobRow({ job, live = true }: JobRowProps): JSX.Element {
  const { client, options } = useApi();
  const isTerminal = TERMINAL.has(job.status);
  const liveEvent = useJobEvents(options, live && !isTerminal ? job.id : undefined) as
    | UiJobEvent
    | null;
  const deleteJob = useDeleteJob(client);

  const [localProgress, setLocalProgress] = useState<UiJobProgress | null>(job.progress ?? null);
  const [localStatus, setLocalStatus] = useState<string>(job.status);

  useEffect(() => {
    if (!liveEvent) return;
    if (liveEvent.progress) setLocalProgress(liveEvent.progress);
    if (liveEvent.status) setLocalStatus(liveEvent.status);
    else if (liveEvent.type && liveEvent.type !== 'log') setLocalStatus(liveEvent.type);
  }, [liveEvent]);

  useEffect(() => {
    setLocalStatus(job.status);
    if (job.progress) setLocalProgress(job.progress);
  }, [job.status, job.progress]);

  const pct = useMemo(() => {
    const p = localProgress?.percent;
    if (typeof p === 'number') return Math.max(0, Math.min(100, p));
    const total = localProgress?.total_bytes;
    const got = localProgress?.downloaded_bytes;
    if (total && got) return Math.max(0, Math.min(100, (got / total) * 100));
    return null;
  }, [localProgress]);

  const handleDelete = () => {
    if (!confirm('Remove this job?')) return;
    deleteJob.mutate(job.id);
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
          {job.thumbnail ? (
            <img src={job.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <FileVideo className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SiteBadge site={job.site ?? null} />
            <StatusIcon status={localStatus} />
            <span className="text-xs uppercase tracking-wide text-zinc-500">{localStatus}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {job.title ?? job.url}
          </p>
          <p className="line-clamp-1 text-xs text-zinc-500">{job.url}</p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteJob.isPending}
          aria-label="Delete job"
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:hover:bg-zinc-800"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!isTerminal && (
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? 0}
            aria-label="Download progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          >
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
            <span>{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
            <span>{formatSpeed(localProgress?.speed_bps ?? null)}</span>
            <span>ETA {formatDuration(localProgress?.eta_seconds ?? null)}</span>
            {localProgress?.total_bytes != null && (
              <span>
                {formatBytes(localProgress?.downloaded_bytes ?? 0)} /{' '}
                {formatBytes(localProgress.total_bytes)}
              </span>
            )}
          </div>
        </div>
      )}

      {job.error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {job.error}
        </p>
      )}
    </li>
  );
}
