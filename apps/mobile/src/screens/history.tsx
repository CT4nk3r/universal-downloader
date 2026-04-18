/**
 * History screen — finished/failed/cancelled/expired jobs with search,
 * re-download, and delete actions.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  RefreshControl,
  SafeAreaView,
  type ListRenderItemInfo,
} from 'react-native';
import type { Job, JobStatus } from '@universal-downloader/api-client';
import {
  useJobs,
  useDeleteJob,
  useCreateJob,
} from '@universal-downloader/api-client/hooks';
import { useApi } from '../lib/api-context';
import { useTheme } from '../lib/theme';
import { JobRow } from '../components/job-row';

const TERMINAL: ReadonlyArray<JobStatus> = ['ready', 'failed', 'cancelled', 'expired'];

export function HistoryScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const client = useApi();
  const jobs = useJobs(client);
  const del = useDeleteJob(client);
  const create = useCreateJob(client);
  const [query, setQuery] = useState('');

  const items = useMemo<Job[]>(() => {
    const list = (jobs.data ?? []) as Job[];
    const q = query.trim().toLowerCase();
    return list
      .filter((j) => TERMINAL.includes(j.status as JobStatus))
      .filter((j) => {
        if (!q) return true;
        const t = ((j as { title?: string }).title ?? '').toLowerCase();
        const u = (j.url ?? '').toLowerCase();
        return t.includes(q) || u.includes(q);
      });
  }, [jobs.data, query]);

  const onRedownload = useCallback(
    (job: Job) => {
      const j = job as Job & { preset?: string; container?: string };
      create.mutate({
        url: j.url,
        preset: (j.preset as never) ?? undefined,
        container: (j.container as never) ?? undefined,
      });
      Alert.alert('Re-queued', 'The job has been re-added to the queue.');
    },
    [create],
  );

  const onDelete = useCallback(
    (job: Job) => {
      Alert.alert('Delete job?', 'This removes it from history.', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => del.mutate(job.id) },
      ]);
    },
    [del],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Job>) => (
      <View style={styles.itemWrap}>
        <JobRow job={item} showActions={false} />
        <View style={styles.btnRow}>
          <Pressable
            onPress={() => onRedownload(item)}
            accessibilityRole="button"
            accessibilityLabel="Re-download this job"
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: palette.primary,
                backgroundColor: palette.background,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            testID={`redownload-${item.id}`}
          >
            <Text style={[styles.actionText, { color: palette.primary }]}>Re-download</Text>
          </Pressable>
          <Pressable
            onPress={() => onDelete(item)}
            accessibilityRole="button"
            accessibilityLabel="Delete this job"
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: palette.danger,
                backgroundColor: palette.background,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            testID={`delete-${item.id}`}
          >
            <Text style={[styles.actionText, { color: palette.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    ),
    [onRedownload, onDelete, palette],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: palette.card,
              color: palette.text,
              borderColor: palette.border,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title or URL"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search history"
          testID="history-search"
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(j) => j.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        refreshControl={
          <RefreshControl
            refreshing={jobs.isFetching}
            onRefresh={() => void jobs.refetch()}
            tintColor={palette.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No history yet
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
              Completed jobs will appear here.
            </Text>
          </View>
        }
        testID="history-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchWrap: { padding: 12 },
  search: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  gap: { height: 12 },
  itemWrap: { gap: 8 },
  btnRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionText: { fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
