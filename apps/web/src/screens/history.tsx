import { useMemo, useState } from 'react';
import { Search, RotateCw, Trash2, FileVideo, History as HistoryIcon } from 'lucide-react';
import { useApi } from '@/lib/api-context';
import { useDeleteJob, useJobs, useCreateJob } from '@universal-downloader/api-client/hooks';
import type { CreateJobRequest } from '@universal-downloader/api-client';
import { SiteBadge } from '@/components/site-badge';
import { formatBytes } from '@/components/format-bytes';
import type { UiJob } from '@/components/types';

const TERMINAL: ReadonlySet<string> = new Set(['ready', 'failed', 'cancelled', 'expired']);

export function HistoryScreen(): JSX.Element {
  const { client } = useApi();
  const jobsQuery = useJobs(client);
  const deleteJob = useDeleteJob(client);
  const createJob = useCreateJob(client);

  const [q, setQ] = useState('');

  const jobs = useMemo<UiJob[]>(() => {
    const all = (jobsQuery.data ?? []) as unknown as UiJob[];
    const terminal = all.filter((j) => TERMINAL.has(j.status));
    if (!q.trim()) return terminal;
    const needle = q.trim().toLowerCase();
    return terminal.filter(
      (j) =>
        (j.title ?? '').toLowerCase().includes(needle) ||
        j.url.toLowerCase().includes(needle),
    );
  }, [jobsQuery.data, q]);

  const handleRedownload = (j: UiJob) => {
    const body = {
      url: j.url,
      preset: j.preset ?? 'best',
    } as unknown as CreateJobRequest;
    createJob.mutate(body);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this entry from history?')) return;
    deleteJob.mutate(id);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <HistoryIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">History</h1>
      </header>

      <label className="relative block">
        <span className="sr-only">Search by title or URL</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title or URL…"
          className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {jobsQuery.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 py-12 text-zinc-500 dark:border-zinc-700">
          <FileVideo className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">No completed downloads yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li
              key={j.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                {j.thumbnail ? (
                  <img
                    src={j.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileVideo className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SiteBadge site={j.site ?? null} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      j.status === 'ready'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                        : j.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {j.status}
                  </span>
                  {j.progress?.total_bytes != null && (
                    <span className="text-xs text-zinc-500">
                      {formatBytes(j.progress.total_bytes)}
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {j.title ?? j.url}
                </p>
                <p className="line-clamp-1 text-xs text-zinc-500">{j.url}</p>
                {j.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{j.error}</p>
                )}
              </div>
              <div className="flex gap-1 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleRedownload(j)}
                  disabled={createJob.isPending}
                  aria-label="Re-download"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Re-download
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(j.id)}
                  disabled={deleteJob.isPending}
                  aria-label="Delete"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
