/**
 * Theme application helpers.
 *
 * We toggle BOTH `data-theme="dark"` (used by Tailwind's `darkMode` selector)
 * AND the `dark` class so consumer libs that only check one of them work.
 */
import type { Theme } from './settings-store';

const MEDIA = '(prefers-color-scheme: dark)';

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia(MEDIA).matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
}

/** Subscribes to `prefers-color-scheme` while theme === 'system'. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(MEDIA);
  const handler = (): void => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
