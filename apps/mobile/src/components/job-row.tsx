import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import type { Job } from '@universal-downloader/api-client';
import { useJobEvents, useDeleteJob } from '@universal-downloader/api-client/hooks';
import { useApi } from '../lib/api-context';
import { useApiOptions } from '../hooks/use-api-options';
import { useTheme } from '../lib/theme';
import { ProgressBar } from './progress-bar';
import { formatBytes } from './format-bytes';
import { SaveToDeviceModule } from '../native/SaveToDeviceModule';

export interface JobRowProps {
  job: Job;
  showActions?: boolean;
  onPress?: (job: Job) => void;
}

type JobLike = Job & {
  title?: string;
  url?: string;
  progress?: number;
  result_url?: string;
  container?: string;
};

type EventLike = {
  status?: Job['status'];
  progress?: number;
  speed_bps?: number;
  eta_seconds?: number;
} | null;

export function JobRow({ job, showActions = true, onPress }: JobRowProps): React.JSX.Element {
  const { palette } = useTheme();
  const client = useApi();
  const opts = useApiOptions();
  const event = useJobEvents(opts, job.id) as EventLike;
  const del = useDeleteJob(client);

  const j = job as JobLike;
  const status = (event?.status ?? j.status) as Job['status'];
  const progress =
    typeof event?.progress === 'number'
      ? event.progress
      : typeof j.progress === 'number'
        ? j.progress
        : null;
  const speed = event?.speed_bps;
  const eta = event?.eta_seconds;

  const onCancel = useCallback(() => {
    Alert.alert('Cancel job?', 'This will stop the download.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => del.mutate(j.id),
      },
    ]);
  }, [del, j.id]);

  const onSave = useCallback(async () => {
    const url = j.result_url;
    if (!url) {
      Alert.alert('Not ready', 'No file URL available yet.');
      return;
    }
    try {
      const isAudio =
        j.container === 'm4a' || j.container === 'mp3' || j.container === 'opus';
      if (isAudio) await SaveToDeviceModule.saveAudio(url);
      else await SaveToDeviceModule.saveVideo(url);
      Alert.alert('Saved', 'File saved to your device.');
    } catch (err) {
      Alert.alert('Save failed', (err as Error)?.message ?? 'Unknown error');
    }
  }, [j.container, j.result_url]);

  const isInflight =
    status === 'queued' ||
    status === 'probing' ||
    status === 'downloading' ||
    status === 'postprocessing';

  return (
    <Pressable
      onPress={onPress ? () => onPress(job) : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
      testID={`job-row-${j.id}`}
    >
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
          {j.title ?? j.url ?? 'Job'}
        </Text>
        <Text style={[styles.status, { color: statusColor(status, palette) }]}>
          {status}
        </Text>
      </View>
      {isInflight ? (
        <>
          <ProgressBar value={progress} style={styles.bar} />
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {progress != null ? `${Math.round(progress * 100)}%` : '…'}
            {speed ? `  ·  ${formatBytes(speed)}/s` : ''}
            {typeof eta === 'number' ? `  ·  ETA ${eta}s` : ''}
          </Text>
        </>
      ) : null}
      {showActions ? (
        <View style={styles.actions}>
          {isInflight ? (
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel download"
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: palette.background, borderColor: palette.danger, opacity: pressed ? 0.6 : 1 },
              ]}
              testID={`cancel-${j.id}`}
            >
              <Text style={[styles.actionText, { color: palette.danger }]}>Cancel</Text>
            </Pressable>
          ) : null}
          {status === 'ready' ? (
            <Pressable
              onPress={onSave}
              accessibilityRole="button"
              accessibilityLabel="Save to device"
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: palette.primary, borderColor: palette.primary, opacity: pressed ? 0.7 : 1 },
              ]}
              testID={`save-${j.id}`}
            >
              <Text style={[styles.actionText, { color: '#ffffff' }]}>Save</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function statusColor(s: Job['status'], palette: ReturnType<typeof useTheme>['palette']): string {
  switch (s) {
    case 'ready':
      return '#2da44e';
    case 'failed':
      return palette.danger;
    case 'cancelled':
    case 'expired':
      return palette.textMuted;
    default:
      return palette.primary;
  }
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  bar: { marginTop: 4 },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '700' },
});
