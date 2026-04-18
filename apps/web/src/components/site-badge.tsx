import { Globe, Youtube, Facebook, MessageCircle, Twitter } from 'lucide-react';

interface SiteBadgeProps {
  site: string | null | undefined;
  className?: string;
}

const META: Record<string, { label: string; classes: string }> = {
  youtube: {
    label: 'YouTube',
    classes: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
  x: { label: 'X', classes: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100' },
  facebook: {
    label: 'Facebook',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  },
  reddit: {
    label: 'Reddit',
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  },
};

// TODO: replace with @universal-downloader/ui Badge
export function SiteBadge({ site, className = '' }: SiteBadgeProps): JSX.Element {
  const key = (site ?? '').toString().toLowerCase();
  const meta = META[key] ?? {
    label: site ? key : 'Unknown',
    classes: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  };
  const Icon =
    key === 'youtube'
      ? Youtube
      : key === 'facebook'
        ? Facebook
        : key === 'reddit'
          ? MessageCircle
          : key === 'x'
            ? Twitter
            : Globe;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.classes} ${className}`}
      aria-label={`Site: ${meta.label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
