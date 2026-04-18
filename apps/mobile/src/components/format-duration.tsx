import React from 'react';
import { Text, type TextProps } from 'react-native';

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function FormatDuration({
  seconds,
  ...rest
}: { seconds: number | null | undefined } & TextProps) {
  return <Text {...rest}>{formatDuration(seconds)}</Text>;
}
