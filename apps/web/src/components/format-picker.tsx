import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { QualityPreset } from '@universal-downloader/shared-types';
import type { UiFormat } from './types';
import { formatBytes } from './format-bytes';

export type FormatChoice =
  | { kind: 'preset'; preset: QualityPreset }
  | { kind: 'format'; format_id: string; container?: string };

interface PresetChip {
  id: QualityPreset;
  label: string;
  hint: string;
}

const CHIPS: readonly PresetChip[] = [
  { id: 'best', label: 'Best', hint: 'Highest quality available' },
  { id: 'p1080', label: '1080p MP4', hint: 'Full HD video' },
  { id: 'p720', label: '720p MP4', hint: 'HD video' },
  { id: 'audio_mp3', label: 'Audio MP3', hint: 'Audio only, MP3' },
  { id: 'audio_m4a', label: 'Audio M4A', hint: 'Audio only, M4A' },
];

interface FormatPickerProps {
  formats: UiFormat[];
  value: FormatChoice;
  onChange: (c: FormatChoice) => void;
}

// TODO: replace with @universal-downloader/ui ToggleGroup + Table
export function FormatPicker({ formats, value, onChange }: FormatPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Quality preset" className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const selected = value.kind === 'preset' && value.preset === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={c.hint}
              onClick={() => onChange({ kind: 'preset', preset: c.id })}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                selected
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="advanced-formats"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Advanced ({formats.length} formats)
      </button>

      {open && (
        <div id="advanced-formats" className="rounded-md border border-zinc-200 dark:border-zinc-800">
          {/* Mobile: cards */}
          <ul className="divide-y divide-zinc-200 sm:hidden dark:divide-zinc-800">
            {formats.map((f) => {
              const selected = value.kind === 'format' && value.format_id === f.format_id;
              return (
                <li key={f.format_id}>
                  <button
                    type="button"
                    onClick={() => onChange({ kind: 'format', format_id: f.format_id, container: f.ext })}
                    aria-pressed={selected}
                    className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-400 ${
                      selected ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="font-medium">
                      {f.format_id} · {f.ext}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {f.resolution ?? '—'} {f.fps ? `@${f.fps}fps` : ''} ·{' '}
                      {f.vcodec && f.vcodec !== 'none' ? f.vcodec : 'audio'}
                      {f.acodec && f.acodec !== 'none' ? ` / ${f.acodec}` : ''}
                    </span>
                    <span className="text-xs text-zinc-500">{formatBytes(f.filesize ?? null)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-3 py-2">ID</th>
                  <th scope="col" className="px-3 py-2">Ext</th>
                  <th scope="col" className="px-3 py-2">Resolution</th>
                  <th scope="col" className="px-3 py-2">Codec</th>
                  <th scope="col" className="px-3 py-2">Size</th>
                  <th scope="col" className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {formats.map((f) => {
                  const selected = value.kind === 'format' && value.format_id === f.format_id;
                  return (
                    <tr
                      key={f.format_id}
                      onClick={() =>
                        onChange({ kind: 'format', format_id: f.format_id, container: f.ext })
                      }
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onChange({ kind: 'format', format_id: f.format_id, container: f.ext });
                        }
                      }}
                      className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-400 ${
                        selected
                          ? 'bg-zinc-100 dark:bg-zinc-800'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{f.format_id}</td>
                      <td className="px-3 py-2">{f.ext}</td>
                      <td className="px-3 py-2">
                        {f.resolution ?? '—'}
                        {f.fps ? ` @${f.fps}` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {f.vcodec && f.vcodec !== 'none' ? f.vcodec : '—'}
                        {f.acodec && f.acodec !== 'none' ? ` / ${f.acodec}` : ''}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {formatBytes(f.filesize ?? null)}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{f.note ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
