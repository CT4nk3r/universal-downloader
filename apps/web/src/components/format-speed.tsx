import { formatBytes } from './format-bytes';

/**
 * Format a bytes-per-second rate as `X.X MB/s`.
 */
export function formatSpeed(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return '—';
  return `${formatBytes(bps)}/s`;
}

export function FormatSpeed({ bps }: { bps: number | null | undefined }): string {
  return formatSpeed(bps);
}
