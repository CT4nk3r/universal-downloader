/**
 * Theme bootstrap — applies `data-theme="dark"` on <html> based on settings.
 */
import { useEffect } from 'react';
import { useSettings, type Theme } from './settings-store';

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

export function useApplyTheme(): void {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const applied = resolve(theme);
    document.documentElement.dataset.theme = applied;
  }, [theme]);
}
