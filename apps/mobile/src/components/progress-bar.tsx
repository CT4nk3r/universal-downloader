import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

export interface ProgressBarProps {
  /** 0..1 fraction. If null/undefined → indeterminate look. */
  value?: number | null;
  height?: number;
  style?: ViewStyle;
  testID?: string;
}

export function ProgressBar({ value, height = 6, style, testID }: ProgressBarProps): React.JSX.Element {
  const { palette } = useTheme();
  const clamped =
    value == null || !isFinite(value) ? null : Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={
        clamped == null
          ? undefined
          : { now: Math.round(clamped * 100), min: 0, max: 100 }
      }
      testID={testID}
      style={[styles.track, { height, backgroundColor: palette.card }, style]}
    >
      <View
        style={[
          styles.fill,
          {
            width: clamped == null ? '100%' : `${clamped * 100}%`,
            backgroundColor: palette.primary,
            opacity: clamped == null ? 0.35 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
