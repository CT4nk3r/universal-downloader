/**
 * Settings — apiBaseUrl, apiKey (Keychain), defaultPreset, theme,
 * "Test connection" button, and the brand footer.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useHealth } from '@universal-downloader/api-client/hooks';
import { useApi, useApiContext } from '../lib/api-context';
import {
  useSettings,
  type DownloadPreset,
  type ThemePreference,
} from '../lib/settings-store';
import { useTheme } from '../lib/theme';
import { setApiKey, getApiKey, clearApiKey } from '../lib/keychain';

const PRESET_OPTIONS: ReadonlyArray<{ id: DownloadPreset; label: string }> = [
  { id: 'audio-mp3', label: 'Audio MP3' },
  { id: 'audio-flac', label: 'Audio FLAC' },
  { id: 'video-1080p', label: 'Video 1080p' },
  { id: 'video-best', label: 'Video Best' },
];

const THEME_OPTIONS: ReadonlyArray<{ id: ThemePreference; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function SettingsScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const client = useApi();
  const { reloadApiKey } = useApiContext();
  const apiBaseUrl = useSettings((s) => s.apiBaseUrl);
  const setApiBaseUrl = useSettings((s) => s.setApiBaseUrl);
  const defaultPreset = useSettings((s) => s.defaultPreset);
  const setDefaultPreset = useSettings((s) => s.setDefaultPreset);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);

  const [baseUrlDraft, setBaseUrlDraft] = useState(apiBaseUrl);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [hasKey, setHasKey] = useState(false);

  // Health check is enabled-on-demand
  const health = useHealth(client, { enabled: false });

  useEffect(() => {
    void getApiKey().then((k) => setHasKey(!!k));
  }, []);

  useEffect(() => {
    setBaseUrlDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  const onSaveBaseUrl = useCallback(() => {
    const u = baseUrlDraft.trim();
    if (!u) return;
    setApiBaseUrl(u);
    Alert.alert('Saved', 'API base URL updated.');
  }, [baseUrlDraft, setApiBaseUrl]);

  const onSaveApiKey = useCallback(async () => {
    const k = apiKeyDraft.trim();
    if (!k) {
      Alert.alert('Empty key', 'Enter an API key first.');
      return;
    }
    await setApiKey(k);
    await reloadApiKey();
    setApiKeyDraft('');
    setHasKey(true);
    Alert.alert('Saved', 'API key stored in the device keychain.');
  }, [apiKeyDraft, reloadApiKey]);

  const onClearApiKey = useCallback(async () => {
    await clearApiKey();
    await reloadApiKey();
    setHasKey(false);
    Alert.alert('Cleared', 'API key removed.');
  }, [reloadApiKey]);

  const onTestConnection = useCallback(async () => {
    try {
      const res = await health.refetch();
      if (res.error) throw res.error;
      Alert.alert('Connected', 'API responded successfully.');
    } catch (err) {
      Alert.alert(
        'Connection failed',
        (err as Error)?.message ?? 'Unable to reach API.',
      );
    }
  }, [health]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* API base URL */}
        <Section title="API" palette={palette}>
          <Label palette={palette}>Base URL</Label>
          <TextInput
            value={baseUrlDraft}
            onChangeText={setBaseUrlDraft}
            placeholder="http://localhost:8787/v1"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
            ]}
            accessibilityLabel="API base URL"
            testID="api-base-url"
          />
          <PrimaryBtn label="Save URL" onPress={onSaveBaseUrl} palette={palette} testID="save-base-url" />

          <Label palette={palette}>API Key</Label>
          <TextInput
            value={apiKeyDraft}
            onChangeText={setApiKeyDraft}
            placeholder={hasKey ? '••••••••• (stored)' : 'Paste API key'}
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
            ]}
            accessibilityLabel="API key"
            testID="api-key"
          />
          <View style={styles.btnRow}>
            <PrimaryBtn label="Save Key" onPress={onSaveApiKey} palette={palette} testID="save-api-key" />
            {hasKey ? (
              <SecondaryBtn
                label="Clear"
                onPress={onClearApiKey}
                palette={palette}
                color={palette.danger}
                testID="clear-api-key"
              />
            ) : null}
          </View>

          <SecondaryBtn
            label={health.isFetching ? 'Testing…' : 'Test connection'}
            onPress={onTestConnection}
            palette={palette}
            testID="test-connection"
          />
        </Section>

        {/* Default preset */}
        <Section title="Default preset" palette={palette}>
          <View style={styles.chipRow}>
            {PRESET_OPTIONS.map((p) => {
              const selected = p.id === defaultPreset;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setDefaultPreset(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Default preset ${p.label}`}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? palette.primary : palette.card,
                      borderColor: selected ? palette.primary : palette.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  testID={`default-preset-${p.id}`}
                >
                  <Text
                    style={[styles.chipText, { color: selected ? '#ffffff' : palette.text }]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Theme */}
        <Section title="Theme" palette={palette}>
          <View style={styles.chipRow}>
            {THEME_OPTIONS.map((t) => {
              const selected = t.id === theme;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTheme(t.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Theme ${t.label}`}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? palette.primary : palette.card,
                      borderColor: selected ? palette.primary : palette.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  testID={`theme-${t.id}`}
                >
                  <Text
                    style={[styles.chipText, { color: selected ? '#ffffff' : palette.text }]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerBrand, { color: palette.text }]}>
            Universal Downloader
          </Text>
          <Text style={[styles.footerBy, { color: palette.textMuted }]}>by CT4nk3r</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: ReturnType<typeof useTheme>['palette'];
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Label({
  palette,
  children,
}: {
  palette: ReturnType<typeof useTheme>['palette'];
  children: React.ReactNode;
}): React.JSX.Element {
  return <Text style={[styles.label, { color: palette.text }]}>{children}</Text>;
}

function PrimaryBtn({
  label,
  onPress,
  palette,
  testID,
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
  testID?: string;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.primary, opacity: pressed ? 0.6 : 1 },
      ]}
      testID={testID}
    >
      <Text style={[styles.btnText, { color: '#ffffff' }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryBtn({
  label,
  onPress,
  palette,
  color,
  testID,
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
  color?: string;
  testID?: string;
}): React.JSX.Element {
  const c = color ?? palette.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.background,
          borderColor: c,
          borderWidth: 1.5,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.btnText, { color: c }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  btn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 8, paddingVertical: 16 },
  footerBrand: { fontSize: 15, fontWeight: '700' },
  footerBy: { fontSize: 12, marginTop: 2 },
});
