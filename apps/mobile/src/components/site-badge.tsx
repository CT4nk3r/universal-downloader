import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { SiteId } from '@universal-downloader/shared-types';

const LABELS: Record<SiteId | 'unknown', string> = {
  youtube: 'YouTube',
  x: 'X / Twitter',
  facebook: 'Facebook',
  reddit: 'Reddit',
  unknown: 'Generic',
};

const COLORS: Record<SiteId | 'unknown', string> = {
  youtube: '#FF0033',
  x: '#1D9BF0',
  facebook: '#1877F2',
  reddit: '#FF4500',
  unknown: '#6B7280',
};

export interface SiteBadgeProps {
  site: SiteId | null | undefined;
}

export function SiteBadge({ site }: SiteBadgeProps): React.JSX.Element {
  const key = (site ?? 'unknown') as SiteId | 'unknown';
  return (
    <View
      style={[styles.badge, { backgroundColor: COLORS[key] }]}
      accessibilityLabel={`Site ${LABELS[key]}`}
    >
      <Text style={styles.text}>{LABELS[key]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
});
