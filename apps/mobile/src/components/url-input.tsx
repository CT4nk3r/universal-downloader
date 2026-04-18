import React, { useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../lib/theme';
import { useClipboard } from '../hooks/use-clipboard';
import { SiteBadge } from './site-badge';
import { detectSite, type SiteId } from '@universal-downloader/shared-types';

export interface UrlInputProps {
  value: string;
  onChangeText: (s: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function UrlInput({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Paste a video URL…',
  autoFocus,
}: UrlInputProps): React.JSX.Element {
  const { palette } = useTheme();
  const { getString } = useClipboard();
  const site: SiteId | null = value.length > 6 ? detectSite(value) : null;

  const onPaste = useCallback(async () => {
    const s = await getString();
    if (s) onChangeText(s.trim());
  }, [getString, onChangeText]);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.row,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <TextInput
          style={[styles.input, { color: palette.text }]}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="url"
          keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
          returnKeyType="go"
          autoFocus={autoFocus}
          accessibilityLabel="Video URL"
          testID="url-input"
        />
        <Pressable
          onPress={onPaste}
          accessibilityRole="button"
          accessibilityLabel="Paste URL from clipboard"
          hitSlop={8}
          style={({ pressed }) => [
            styles.pasteBtn,
            { backgroundColor: palette.background, opacity: pressed ? 0.6 : 1, borderColor: palette.primary },
          ]}
          testID="paste-btn"
        >
          <Text style={[styles.pasteText, { color: palette.primary }]}>Paste</Text>
        </Pressable>
      </View>
      {site ? (
        <View style={styles.badgeRow}>
          <SiteBadge site={site} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  pasteBtn: {
    minHeight: 36,
    minWidth: 60,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pasteText: { fontSize: 14, fontWeight: '600' },
  badgeRow: { flexDirection: 'row' },
});
