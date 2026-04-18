import { Clock, User } from 'lucide-react';
import { SiteBadge } from './site-badge';
import { formatDuration } from './format-duration';
import type { UiProbeResult } from './types';

interface ProbeCardProps {
  probe: UiProbeResult;
}

// TODO: replace with @universal-downloader/ui Card
export function ProbeCard({ probe }: ProbeCardProps): JSX.Element {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col sm:flex-row">
        {probe.thumbnail ? (
          <img
            src={probe.thumbnail}
            alt=""
            className="aspect-video w-full object-cover sm:w-56 sm:flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-video w-full bg-zinc-100 sm:w-56 sm:flex-shrink-0 dark:bg-zinc-800"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <div className="flex items-start gap-2">
            <SiteBadge site={probe.site} />
          </div>
          <h2 className="line-clamp-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {probe.title}
          </h2>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {probe.uploader && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" aria-hidden="true" />
                <dt className="sr-only">Uploader</dt>
                <dd>{probe.uploader}</dd>
              </div>
            )}
            {probe.duration_seconds != null && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <dt className="sr-only">Duration</dt>
                <dd>{formatDuration(probe.duration_seconds)}</dd>
              </div>
            )}
            <div className="flex items-center gap-1">
              <dt className="sr-only">Available formats</dt>
              <dd>{probe.formats.length} formats</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
