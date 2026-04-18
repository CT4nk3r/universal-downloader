/**
 * Queue screen — in-flight jobs with live SSE progress per row.
 * Filters the full job list locally to: queued, probing, downloading,
 * postprocessing.
 */
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  type ListRenderItemInfo,
} from 'react-native';
import type { Job, JobStatus } from '@universal-downloader/api-client';
import { useJobs } from '@universal-downloader/api-client/hooks';
import { useApi } from '../lib/api-context';
import { useTheme } from '../lib/theme';
import { JobRow } from '../components/job-row';

const ACTIVE_STATUSES: ReadonlyArray<JobStatus> = [
  'queued',
  'probing',
  'downloading',
  'postprocessing',
];

export function QueueScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const client = useApi();
  const jobs = useJobs(client);

  const items = useMemo<Job[]>(() => {
    const list = (jobs.data ?? []) as Job[];
    return list.filter((j) => ACTIVE_STATUSES.includes(j.status as JobStatus));
  }, [jobs.data]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Job>) => <JobRow job={item} />,
    [],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
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
              Nothing downloading
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
              Paste or share a URL on the Home tab to get started.
            </Text>
          </View>
        }
        testID="queue-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 16, flexGrow: 1 },
  gap: { height: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
