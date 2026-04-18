/**
 * Human-friendly formatters. All pure, locale-agnostic (English),
 * safe to call in any JS runtime.
 */

const BIN_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'] as const;

/** Format a byte count using binary (1024-based) units. Negatives → `-` prefix. */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  const exp = Math.min(Math.floor(Math.log(abs) / Math.log(1024)), BIN_UNITS.length - 1);
  const value = abs / Math.pow(1024, exp);
  const dp = Math.max(0, Math.min(20, decimals));
  // Trim trailing zeros for nicer display ("1 KiB" not "1.00 KiB")
  const fixed = value.toFixed(dp);
  const trimmed = dp > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
  return `${sign}${trimmed} ${BIN_UNITS[exp]}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format seconds → `H:MM:SS` / `M:SS` / `0:SS`. Negatives → `0:00`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

/** Format a download speed (bytes/sec) → "1.23 MiB/s". */
export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 B/s';
  return `${formatBytes(bps)}/s`;
}

/** Format an ETA in seconds → "~3m left", "~12s left", "~1h 5m left". */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `~${s}s left`;
  const m = Math.round(s / 60);
  if (m < 60) return `~${m}m left`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `~${h}h ${remM}m left` : `~${h}h left`;
}

const REL_THRESHOLDS: ReadonlyArray<readonly [number, string]> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

/** "2 minutes ago" / "in 3 hours". */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'unknown';
  const diffMs = d.getTime() - Date.now();
  const future = diffMs > 0;
  let value = Math.abs(diffMs) / 1000;
  let unit = 'second';
  for (const [div, u] of REL_THRESHOLDS) {
    if (value < div) {
      unit = u;
      break;
    }
    value /= div;
    unit = u;
  }
  const rounded = Math.max(1, Math.round(value));
  const plural = rounded === 1 ? unit : `${unit}s`;
  return future ? `in ${rounded} ${plural}` : `${rounded} ${plural} ago`;
}
