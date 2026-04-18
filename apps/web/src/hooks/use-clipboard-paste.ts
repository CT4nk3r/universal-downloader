import { useCallback } from 'react';

/**
 * Read text from the system clipboard. Returns null if blocked or empty.
 * Wrapped so callers don't have to deal with permissions / SSR.
 */
export function useClipboardPaste(): () => Promise<string | null> {
  return useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null;
    try {
      const text = await navigator.clipboard.readText();
      return text.trim() || null;
    } catch {
      return null;
    }
  }, []);
}
