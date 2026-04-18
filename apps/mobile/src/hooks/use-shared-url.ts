import { useEffect, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { SharedUrlModule } from '../native/SharedUrlModule';

const SCHEME = 'universal-downloader://';

function extractUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(SCHEME)) {
    try {
      // universal-downloader://share?url=<encoded>
      const u = new URL(trimmed);
      const inner = u.searchParams.get('url');
      return inner ? decodeURIComponent(inner) : null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

/**
 * Returns the most recent URL shared into the app from the OS share sheet
 * or `universal-downloader://share?url=…` deep link. Consumers typically use
 * this to pre-fill the home screen's URL input.
 */
export function useSharedUrl(): {
  url: string | null;
  consume: () => void;
} {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void SharedUrlModule.getInitialUrl().then((u) => {
      if (cancelled) return;
      const v = extractUrl(u);
      if (v) setUrl(v);
    });
    void Linking.getInitialURL().then((u) => {
      if (cancelled) return;
      const v = extractUrl(u);
      if (v) setUrl((prev) => prev ?? v);
    });
    const offNative = SharedUrlModule.addUrlListener((u) => {
      const v = extractUrl(u);
      if (v) setUrl(v);
    });
    const sub = Linking.addEventListener('url', ({ url: u }) => {
      const v = extractUrl(u);
      if (v) setUrl(v);
    });
    return () => {
      cancelled = true;
      offNative();
      sub.remove();
    };
  }, []);

  const consume = useCallback(() => setUrl(null), []);
  return { url, consume };
}
