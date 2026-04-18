/**
 * Home screen — paste/share a URL, probe for metadata, pick a quality preset
 * and enqueue a download. After enqueue, navigates to the Queue tab so the
 * user can watch progress.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProbe, useCreateJob } from '@universal-downloader/api-client/hooks';
import type { QualityPreset } from '@universal-downloader/shared-types';
import { useApi } from '../lib/api-context';
import { useSettings } from '../lib/settings-store';
import { useTheme } from '../lib/theme';
import { UrlInput } from '../components/url-input';
import { ProbeCard } from '../components/probe-card';
import { FormatPicker } from '../components/format-picker';
import { presetFromSettings, isAudioPreset } from '../components/preset-map';
import { useSharedUrl } from '../hooks/use-shared-url';

export function HomeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const nav = useNavigation<{ navigate: (route: string) => void }>();
  const client = useApi();
  const defaultPreset = useSettings((s) => s.defaultPreset);
  const probe = useProbe(client);
  const create = useCreateJob(client);
  const shared = useSharedUrl();

  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState<QualityPreset>(presetFromSettings(defaultPreset));

  // Pre-fill URL from share-sheet / deep link.
  useEffect(() => {
    if (shared.url) {
      setUrl(shared.url);
      shared.consume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.url]);

  const onProbe = useCallback(() => {
    const u = url.trim();
    if (!u) return;
    probe.mutate(u);
  }, [probe, url]);

  const onDownload = useCallback(async () => {
    const u = url.trim();
    if (!u) {
      Alert.alert('Missing URL', 'Paste a video URL first.');
      return;
    }
    try {
      await create.mutateAsync({
        url: u,
        preset,
        audio_only: isAudioPreset(preset),
      });
      setUrl('');
      probe.reset();
      nav.navigate('Queue');
    } catch (err) {
      Alert.alert('Could not enqueue', (err as Error)?.message ?? 'Unknown error');
    }
  }, [create, url, preset, nav, probe]);

  const canDownload = url.trim().length > 0 && !create.isPending;
  const canProbe = url.trim().length > 0 && !probe.isPending;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          testID="home-scroll"
        >
          <Text style={[styles.h1, { color: palette.text }]}>Download</Text>

          <UrlInput value={url} onChangeText={setUrl} onSubmit={onProbe} />

          <View style={styles.btnRow}>
            <Pressable
              onPress={onProbe}
              disabled={!canProbe}
              accessibilityRole="button"
              accessibilityLabel="Probe video metadata"
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: palette.primary,
                  backgroundColor: palette.background,
                  opacity: pressed || !canProbe ? 0.6 : 1,
                },
              ]}
              testID="probe-btn"
            >
              <Text style={[styles.secondaryText, { color: palette.primary }]}>
                {probe.isPending ? 'Probing…' : 'Probe'}
              </Text>
            </Pressable>
          </View>

          <ProbeCard data={probe.data} loading={probe.isPending} error={probe.error} />

          <Text style={[styles.label, { color: palette.textMuted }]}>Quality</Text>
          <FormatPicker value={preset} onChange={setPreset} />

          <Pressable
            onPress={onDownload}
            disabled={!canDownload}
            accessibilityRole="button"
            accessibilityLabel="Download video"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                opacity: pressed || !canDownload ? 0.6 : 1,
              },
            ]}
            testID="download-btn"
          >
            <Text style={styles.primaryText}>
              {create.isPending ? 'Queuing…' : 'Download'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  h1: { fontSize: 28, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
});
