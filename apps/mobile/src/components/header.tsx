/**
 * App header — branded title used by every screen via the bottom-tab
 * `headerTitle` option.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../lib/theme';

export function AppHeader(): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: palette.text }]}>Universal Downloader</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]}>by CT4nk3r</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
