import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { useApi } from '@/lib/api-context';
import { useJobs } from '@universal-downloader/api-client/hooks';
import { JobRow } from './job-row';
import type { UiJob } from './types';

interface QueuePanelProps {
  /** Optimistic jobs prepended on top of the server list (de-duped by id). */
  optimistic?: UiJob[];
}

const ACTIVE: ReadonlySet<string> = new Set([
  'queued',
  'probing',
  'downloading',
  'postprocessing',
]);

export function QueuePanel({ optimistic = [] }: QueuePanelProps): JSX.Element {
  const { client } = useApi();
  const jobsQuery = useJobs(client);

  const jobs = useMemo<UiJob[]>(() => {
    const server = (jobsQuery.data ?? []) as unknown as UiJob[];
    const seen = new Set<string>();
    const out: UiJob[] = [];
    for (const j of [...optimistic, ...server]) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      out.push(j);
    }
    return out.filter((j) => ACTIVE.has(j.status));
  }, [jobsQuery.data, optimistic]);

  return (
    <section aria-label="Active downloads" className="space-y-2">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Active queue
          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {jobs.length}
          </span>
        </h2>
        {jobsQuery.isFetching && <span className="text-xs text-zinc-500">Refreshing…</span>}
      </header>
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 py-8 text-zinc-500 dark:border-zinc-700">
          <Inbox className="h-6 w-6" aria-hidden="true" />
          <p className="text-sm">No active downloads.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </section>
  );
}
