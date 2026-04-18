import { useCallback } from 'react';
import { Clipboard, Platform } from 'react-native';

/**
 * Lightweight clipboard helper. Uses the (deprecated but still shipping)
 * RN Clipboard so we don't add another native dep. Consumers should swap to
 * `@react-native-clipboard/clipboard` when available.
 */
export function useClipboard() {
  const getString = useCallback(async (): Promise<string> => {
    try {
      // @ts-expect-error legacy RN API
      const v = await Clipboard.getString();
      return typeof v === 'string' ? v : '';
    } catch {
      return '';
    }
  }, []);

  const setString = useCallback(async (s: string): Promise<void> => {
    try {
      // @ts-expect-error legacy RN API
      Clipboard.setString(s);
    } catch {
      /* ignore */
    }
  }, []);

  return { getString, setString, platform: Platform.OS };
}
