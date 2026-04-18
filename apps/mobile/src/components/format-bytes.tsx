import React from 'react';
import { Text, type TextProps } from 'react-native';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${UNITS[i]}`;
}

export function FormatBytes({ bytes, ...rest }: { bytes: number | null | undefined } & TextProps) {
  return <Text {...rest}>{formatBytes(bytes)}</Text>;
}
