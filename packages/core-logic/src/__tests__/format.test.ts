import { describe, expect, it, vi } from 'vitest';
import {
  formatBytes,
  formatDuration,
  formatEta,
  formatRelativeTime,
  formatSpeed,
} from '../format.js';

describe('formatBytes', () => {
  it('handles 0 and tiny', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });
  it('uses binary units', () => {
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(1024 * 1024)).toBe('1 MiB');
    expect(formatBytes(1024 ** 3)).toBe('1 GiB');
  });
  it('respects decimals', () => {
    expect(formatBytes(1500, 0)).toBe('1 KiB');
    expect(formatBytes(1500, 4)).toBe('1.4648 KiB');
  });
  it('handles negative bytes', () => {
    expect(formatBytes(-2048)).toBe('-2 KiB');
  });
  it('handles non-finite', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('formats seconds-only', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(42)).toBe('0:42');
  });
  it('formats minutes', () => {
    expect(formatDuration(754)).toBe('12:34');
  });
  it('formats hours', () => {
    expect(formatDuration(3600 + 23 * 60 + 45)).toBe('1:23:45');
  });
  it('floors fractional seconds', () => {
    expect(formatDuration(59.9)).toBe('0:59');
  });
  it('handles invalid', () => {
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('formatSpeed', () => {
  it('formats positive speeds', () => {
    expect(formatSpeed(1024)).toBe('1 KiB/s');
  });
  it('handles zero/negative/invalid', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(-5)).toBe('0 B/s');
    expect(formatSpeed(Number.NaN)).toBe('0 B/s');
  });
});

describe('formatEta', () => {
  it('seconds', () => {
    expect(formatEta(5)).toBe('~5s left');
  });
  it('minutes', () => {
    expect(formatEta(180)).toBe('~3m left');
  });
  it('hours', () => {
    expect(formatEta(3600)).toBe('~1h left');
    expect(formatEta(3900)).toBe('~1h 5m left');
  });
  it('handles invalid', () => {
    expect(formatEta(-1)).toBe('—');
    expect(formatEta(Number.NaN)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  it('past minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(formatRelativeTime(new Date('2025-12-31T23:58:00Z'))).toBe('2 minutes ago');
    vi.useRealTimers();
  });
  it('future hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(formatRelativeTime(new Date('2026-01-01T03:00:00Z'))).toBe('in 3 hours');
    vi.useRealTimers();
  });
  it('accepts ISO string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(formatRelativeTime('2025-12-31T23:59:30Z')).toBe('30 seconds ago');
    vi.useRealTimers();
  });
  it('handles invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('unknown');
  });
});
