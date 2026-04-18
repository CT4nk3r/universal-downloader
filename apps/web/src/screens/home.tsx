import { useId, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/api-context';
import { useCreateJob, useProbe } from '@universal-downloader/api-client/hooks';
import type { CreateJobRequest } from '@universal-downloader/api-client';
import { UrlInput } from '@/components/url-input';
import { ProbeCard } from '@/components/probe-card';
import { FormatPicker, type FormatChoice } from '@/components/format-picker';
import { QueuePanel } from '@/components/queue-panel';
import type { UiJob, UiProbeResult } from '@/components/types';

interface Options {
  subtitles: boolean;
  subtitleLangs: string;
  trimStart: string;
  trimEnd: string;
  embedThumb: boolean;
  embedMeta: boolean;
}

const DEFAULT_OPTIONS: Options = {
  subtitles: false,
  subtitleLangs: 'en',
  trimStart: '',
  trimEnd: '',
  embedThumb: false,
  embedMeta: true,
};

function parseTime(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  // accept "SS", "MM:SS", "HH:MM:SS"
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  return secs >= 0 ? secs : undefined;
}

export function HomeScreen(): JSX.Element {
  const { client } = useApi();
  const probeMut = useProbe(client);
  const createJob = useCreateJob(client);

  const [url, setUrl] = useState('');
  const [choice, setChoice] = useState<FormatChoice>({ kind: 'preset', preset: 'best' });
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optimistic, setOptimistic] = useState<UiJob[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const probe = (probeMut.data ?? null) as unknown as UiProbeResult | null;

  const optsId = useId();

  const handleProbe = (u: string) => {
    setSubmitError(null);
    probeMut.mutate(u);
  };

  const subtitlesObj = useMemo(() => {
    if (!options.subtitles) return undefined;
    const langs = options.subtitleLangs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { enabled: true, languages: langs.length ? langs : ['en'], embed: true };
  }, [options.subtitles, options.subtitleLangs]);

  const handleDownload = async () => {
    if (!probe) return;
    setSubmitError(null);
    const startSec = parseTime(options.trimStart);
    const endSec = parseTime(options.trimEnd);
    const time_range =
      startSec != null || endSec != null
        ? { start_seconds: startSec, end_seconds: endSec }
        : undefined;

    const body: CreateJobRequest = {
      url: probe.url,
      ...(choice.kind === 'preset'
        ? { preset: choice.preset }
        : { format_id: choice.format_id, container: choice.container as never }),
      audio_only: choice.kind === 'preset' && choice.preset.startsWith('audio_'),
      subtitles: subtitlesObj,
      time_range,
      embed_thumbnail: options.embedThumb,
      embed_metadata: options.embedMeta,
    } as unknown as CreateJobRequest;

    // Optimistic placeholder
    const tempId = `optimistic-${Date.now()}`;
    const now = new Date().toISOString();
    const placeholder: UiJob = {
      id: tempId,
      url: probe.url,
      title: probe.title,
      site: probe.site,
      status: 'queued',
      thumbnail: probe.thumbnail ?? null,
      created_at: now,
      updated_at: now,
      progress: { percent: 0 },
    };
    setOptimistic((prev) => [placeholder, ...prev]);

    try {
      const created = (await createJob.mutateAsync(body)) as unknown as UiJob;
      setOptimistic((prev) => prev.map((j) => (j.id === tempId ? created : j)));
      // Eventually the server query refresh will replace it; clear after a moment.
      setTimeout(
        () => setOptimistic((prev) => prev.filter((j) => j.id !== created.id && j.id !== tempId)),
        2000,
      );
    } catch (err) {
      setOptimistic((prev) => prev.filter((j) => j.id !== tempId));
      setSubmitError(err instanceof Error ? err.message : 'Failed to enqueue download');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <UrlInput value={url} onChange={setUrl} onSubmit={handleProbe} busy={probeMut.isPending} />

      {probeMut.isError && (
        <p
          role="alert"
          className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {probeMut.error instanceof Error ? probeMut.error.message : 'Probe failed.'}
        </p>
      )}

      {probeMut.isPending && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Probing URL…
        </div>
      )}

      {probe && (
        <>
          <ProbeCard probe={probe} />
          <FormatPicker formats={probe.formats} value={choice} onChange={setChoice} />

          <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Options
            </legend>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.subtitles}
                  onChange={(e) => setOptions((o) => ({ ...o, subtitles: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                />
                Subtitles
              </label>
              <label className="text-sm sm:flex-1">
                <span className="sr-only">Subtitle languages</span>
                <input
                  type="text"
                  placeholder="en, es"
                  disabled={!options.subtitles}
                  value={options.subtitleLangs}
                  onChange={(e) => setOptions((o) => ({ ...o, subtitleLangs: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  Trim start (e.g. 1:30)
                </span>
                <input
                  id={`${optsId}-start`}
                  type="text"
                  value={options.trimStart}
                  onChange={(e) => setOptions((o) => ({ ...o, trimStart: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  Trim end
                </span>
                <input
                  id={`${optsId}-end`}
                  type="text"
                  value={options.trimEnd}
                  onChange={(e) => setOptions((o) => ({ ...o, trimEnd: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.embedThumb}
                  onChange={(e) => setOptions((o) => ({ ...o, embedThumb: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                />
                Embed thumbnail
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.embedMeta}
                  onChange={(e) => setOptions((o) => ({ ...o, embedMeta: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                />
                Embed metadata
              </label>
            </div>
          </fieldset>

          {submitError && (
            <p
              role="alert"
              className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
            >
              {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              void handleDownload();
            }}
            disabled={createJob.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {createJob.isPending ? 'Adding…' : 'Download'}
          </button>
        </>
      )}

      <QueuePanel optimistic={optimistic} />
    </div>
  );
}
