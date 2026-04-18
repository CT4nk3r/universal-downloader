import { useId, useState, type FormEvent } from 'react';
import { ClipboardPaste, Link2, X } from 'lucide-react';
import { detectSite } from '@universal-downloader/shared-types';
import { useClipboardPaste } from '@/hooks/use-clipboard-paste';
import { SiteBadge } from './site-badge';

interface UrlInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  busy?: boolean;
  placeholder?: string;
}

// TODO: replace with @universal-downloader/ui Input
export function UrlInput({
  value,
  onChange,
  onSubmit,
  busy = false,
  placeholder = 'Paste a video URL…',
}: UrlInputProps): JSX.Element {
  const id = useId();
  const paste = useClipboardPaste();
  const [pasteError, setPasteError] = useState<string | null>(null);
  const site = detectSite(value);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const handlePaste = async () => {
    setPasteError(null);
    const text = await paste();
    if (!text) {
      setPasteError('Clipboard empty or blocked.');
      return;
    }
    onChange(text);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Video URL
      </label>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={busy}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-20 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            aria-describedby={pasteError ? `${id}-err` : undefined}
          />
          {value && !busy && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear URL"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            Paste
          </button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? 'Probing…' : 'Probe'}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {site && <SiteBadge site={site} />}
        {pasteError && (
          <span id={`${id}-err`} className="text-red-600 dark:text-red-400" role="alert">
            {pasteError}
          </span>
        )}
      </div>
    </form>
  );
}
