import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import type { ProbeResult } from '@universal-downloader/api-client';
import { useTheme } from '../lib/theme';
import { SiteBadge } from './site-badge';
import { formatDuration } from './format-duration';

export interface ProbeCardProps {
  data?: ProbeResult | null;
  loading?: boolean;
  error?: unknown;
}

export function ProbeCard({ data, loading, error }: ProbeCardProps): React.JSX.Element | null {
  const { palette } = useTheme();
  if (loading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <ActivityIndicator color={palette.primary} />
        <Text style={{ color: palette.textMuted, marginTop: 8 }}>Probing…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.danger },
        ]}
      >
        <Text style={{ color: palette.danger, fontWeight: '600' }}>Probe failed</Text>
        <Text style={{ color: palette.textMuted, marginTop: 4 }}>
          {(error as Error)?.message ?? 'Unknown error'}
        </Text>
      </View>
    );
  }
  if (!data) return null;

  const d = data as ProbeResult & {
    title?: string;
    uploader?: string;
    duration?: number;
    thumbnail?: string;
    site?: string;
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
      testID="probe-card"
    >
      <View style={styles.row}>
        {d.thumbnail ? (
          <Image source={{ uri: d.thumbnail }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: palette.background }]} />
        )}
        <View style={styles.meta}>
          <Text numberOfLines={2} style={[styles.title, { color: palette.text }]}>
            {d.title ?? 'Untitled'}
          </Text>
          {d.uploader ? (
            <Text
              numberOfLines={1}
              style={[styles.uploader, { color: palette.textMuted }]}
            >
              {d.uploader}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <SiteBadge site={(d.site as never) ?? null} />
            {typeof d.duration === 'number' ? (
              <Text style={[styles.duration, { color: palette.textMuted }]}>
                {formatDuration(d.duration)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 120, height: 68, borderRadius: 8 },
  meta: { flex: 1, justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '600' },
  uploader: { fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  duration: { fontSize: 12 },
});
