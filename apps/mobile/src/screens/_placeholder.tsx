/**
 * Shared placeholder used by every J1.9 screen until J1.10 implements them.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../lib/theme';

export function Placeholder({ name }: { name: string }): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>{name}</Text>
      <Text style={[styles.body, { color: palette.textMuted }]}>Not implemented (J1.10)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14 },
});
