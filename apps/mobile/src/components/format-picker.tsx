import React from 'react';
import { Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { QualityPreset } from '@universal-downloader/shared-types';
import { useTheme } from '../lib/theme';

const PRESETS: ReadonlyArray<{ id: QualityPreset; label: string }> = [
  { id: 'best', label: 'Best' },
  { id: 'p2160', label: '2160p' },
  { id: 'p1440', label: '1440p' },
  { id: 'p1080', label: '1080p' },
  { id: 'p720', label: '720p' },
  { id: 'p480', label: '480p' },
  { id: 'audio_m4a', label: 'Audio M4A' },
  { id: 'audio_mp3', label: 'Audio MP3' },
];

export interface FormatPickerProps {
  value: QualityPreset;
  onChange: (p: QualityPreset) => void;
}

export function FormatPicker({ value, onChange }: FormatPickerProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {PRESETS.map((p) => {
        const selected = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Quality preset ${p.label}`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? palette.primary : palette.card,
                borderColor: selected ? palette.primary : palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID={`preset-${p.id}`}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected ? '#ffffff' : palette.text },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600' },
});
